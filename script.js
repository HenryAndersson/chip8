
const addCSS = css => document.head.appendChild(document.createElement("style")).innerHTML = css;

let canvas = document.querySelector('#canvasMain');
let ctx = canvas.getContext('2d');
canvas.style.backgroundColor = "black";

//file
let GLOBAL_ROM = undefined;
let RUN = false;

document.getElementById('fileInput').addEventListener('change', handleFile);
function handleFile() {
	const fileInput = document.getElementById('fileInput');
	const file = fileInput.files[0];
	if (file) {
		const reader = new FileReader();
		reader.onload = function (event) {
			const content = event.target.result;
			GLOBAL_ROM = event.target.result;
			RUN = true;

			let temp = new Uint8Array(content);
			let tx = "";
			for (let i = 0; i < temp.length; i += 2) {
				let res = (temp[i] << 8) | (temp[i + 1] << 0);
				let a = ((res >> 12) & 0x0f);
				let b = ((res >> 8) & 0x0f);
				let c = ((res >> 4) & 0x0f);
				let d = ((res >> 0) & 0x0f);

				tx += (a.toString(16) + b.toString(16) + c.toString(16)
					+ d.toString(16)) + " ";

			}
			displayFileContent(tx);
		};
		reader.readAsArrayBuffer(file); // You can also use readAsArrayBuffer to read binary data
	}
	addCSS(" .textB > input { display: none; } ");
	addCSS(" .textC { display: none; } ");
}

function displayFileContent(content) {
	const fileContentDiv = document.getElementById('fileContent');
	fileContentDiv.innerHTML = '<strong style="font-size: 28px;">ROM Content:</strong><br>' + content;
}

const HEIGHT = 32;
const WIDTH = 64;

function make2Darray(rand) {
	let arr = [];
	for (let i = 0; i < WIDTH; ++i) {
		let temp_arr = [];
		for (let j = 0; j < HEIGHT; ++j) {
			if (rand == true) {
				temp_arr.push(Math.floor(Math.random() * 2));
			} else {
				temp_arr.push(0);
			}
		}
		arr.push(temp_arr);
	}
	return arr;
}

function draw(arr) {
	for (let i = 0; i < arr.length; ++i) {
		for (let j = 0; j < arr[0].length; ++j) {
			if (arr[i][j] == 0) {
				ctx.fillStyle = "#3b4b4b";
			} else {
				ctx.fillStyle = 'darkorange';
			}
			ctx.fillRect(i * 10, j * 10, 10, 10)
		}
	}
}

//=================================Keypresses==================================

const keys = new Map();
keys.set("1", 0x1);
keys.set("2", 0x2);
keys.set("3", 0x3);
keys.set("4", 0xc);
keys.set("q", 0x4);
keys.set("w", 0x5);
keys.set("e", 0x6);
keys.set("r", 0xd);
keys.set("a", 0x7);
keys.set("s", 0x8);
keys.set("d", 0x9);
keys.set("f", 0xe);
keys.set("z", 0xa);
keys.set("x", 0x0);
keys.set("c", 0xb);
keys.set("v", 0xf);

let keypressed = new Uint8Array(16);

document.addEventListener('keydown', (ev) => {
	if (keys.get(ev.key) != undefined) {
		keypressed[keys.get(ev.key)] = 1;
	}
});

document.addEventListener('keyup', (ev) => {
	if (keys.get(ev.key) != undefined) {
		keypressed[keys.get(ev.key)] = 0;
	}
});

//===================================CPU=======================================

class Chip8Interpreter {
	constructor() {
		this.memory = new Uint8Array(4096);
		this.registers = new Uint8Array(16);
		this.stack = new Uint16Array(16);
		this.stackptr = -1;
		this.display = make2Darray(true);

		this.ST = 0; //sound timer
		this.DT = 0; //delay timer
		this.I = 0;
		this.PC = 0x200;

		//halting for get key
		this.key_down = false;
		this.key_up = false;

		//bad js stuff
		this.delta_realtime = 0;
		this.should_draw = false;

		this.font = [
			0xF0, 0x90, 0x90, 0x90, 0xF0, // 0
			0x20, 0x60, 0x20, 0x20, 0x70, // 1
			0xF0, 0x10, 0xF0, 0x80, 0xF0, // 2
			0xF0, 0x10, 0xF0, 0x10, 0xF0, // 3
			0x90, 0x90, 0xF0, 0x10, 0x10, // 4
			0xF0, 0x80, 0xF0, 0x10, 0xF0, // 5
			0xF0, 0x80, 0xF0, 0x90, 0xF0, // 6
			0xF0, 0x10, 0x20, 0x40, 0x40, // 7
			0xF0, 0x90, 0xF0, 0x90, 0xF0, // 8
			0xF0, 0x90, 0xF0, 0x10, 0xF0, // 9
			0xF0, 0x90, 0xF0, 0x90, 0x90, // A
			0xE0, 0x90, 0xE0, 0x90, 0xE0, // B
			0xF0, 0x80, 0x80, 0x80, 0xF0, // C
			0xE0, 0x90, 0x90, 0x90, 0xE0, // D
			0xF0, 0x80, 0xF0, 0x80, 0xF0, // E
			0xF0, 0x80, 0xF0, 0x80, 0x80  // F
		];

		//load font
		for (let i = 0; i < this.font.length; i++) {
			this.memory[i] = this.font[i];
		}
	}

	load_rom(rom_file) {
		let temp = new Uint8Array(rom_file);
		for (let i = 0; i < temp.length; i++) {
			this.memory[i + 0x200] = temp[i];
		}
	}

	clear_screen() {
		this.display = make2Darray(false);
		chip8.should_draw = true;
	}

	draw_pixel(vx, vy, height) {
		this.registers[0xf] = 0;

		let cord_y = this.registers[vy] % 32;
		for (let i = 0; i < height; i++) {
			let sprite_data = this.memory[this.I + i];
			let cord_x = this.registers[vx] % 64;
			for (let j = 0; j < 8; j++) {
				let pixel = (sprite_data << j) & 0x80;
				if (pixel) {
					this.should_draw = true;
					if (this.display[cord_x][cord_y] == 1) {
						this.display[cord_x][cord_y] = 0;
						this.registers[0xf] = 1;
					}
					else {
						this.display[cord_x][cord_y] = 1;
					}
				}
				cord_x++;
				if (cord_x >= 64) {
					break;
				}
			}
			cord_y++;
		}

	}

	fetch16() {
		let mem1 = this.memory[this.PC + 0];
		let mem2 = this.memory[this.PC + 1];
		let res = (mem1 << 8) | (mem2 << 0);
		this.PC += 2;
		return res;
	}

	execute() {
		if (this.delta_realtime + 16 - Date.now() <= 0) {
			this.delta_realtime = Date.now();
			this.DT = Math.max(--this.DT, 0);
			this.ST = Math.max(--this.ST, 0);
		}

		let abcd = this.fetch16();

		let a = ((abcd >> 12) & 0x0f);
		let b = ((abcd >> 8) & 0x0f);
		let c = ((abcd >> 4) & 0x0f);
		let d = ((abcd >> 0) & 0x0f);
		let cd = ((abcd >> 0) & 0xff);
		let bcd = ((abcd >> 0) & 0xfff);

		switch (true) {
			//00E0 CLS
			case (a == 0x0 && b == 0x0 && c == 0xe && d == 0x0)://clear screen
				this.clear_screen();
				break;

			//00EE RET
			case (a == 0x0 && b == 0x0 && c == 0xe && d == 0xe):// return from subrutine
				this.PC = this.stack[this.stackptr--];
				break;

			//1nnn JP addr
			case (a == 0x1): //jump
				this.PC = bcd;
				break;

			//2nnn CALL addr
			case (a == 0x2): //call subrutine
				this.stack[++this.stackptr] = this.PC;
				this.PC = bcd;
				break;

			//3xnn SE Vx, byte
			case (a == 0x3):
				if (this.registers[b] == cd) {
					this.PC += 2;
				}
				break;

			//4xnn SNE Vx, byte
			case (a == 0x4):
				if (this.registers[b] != cd) {
					this.PC += 2;
				}
				break;

			//5xy0 SE Vx, Vy
			case (a == 0x5):
				if (this.registers[b] == this.registers[c]) {
					this.PC += 2;
				}
				break;

			//6nnn LD Vx, byte
			case (a == 0x6): //set register Vx to cd
				this.registers[b] = cd;
				break;

			//7xnn ADD Vx, byte
			case (a == 0x7): //add value to register VX
				this.registers[b] += cd;
				break;

			//8xyD arithmetic and logical instruction
			case (a == 0x8):
				switch (d) {

					case (0)://LD Vx, Vy
						this.registers[b] = this.registers[c];
						break;

					case (1): //OR Vx, Vy
						this.registers[b] |= this.registers[c];
						this.registers[0xf] = 0;
						break;

					case (2): //AND Vx, Vy
						this.registers[b] &= this.registers[c];
						this.registers[0xf] = 0;
						break;

					case (3): //XOR Vx, Vy
						this.registers[b] ^= this.registers[c];
						this.registers[0xf] = 0;
						break;

					case (4): //ADD Vx, Vy
						let overflow_flag_add = (this.registers[b] + this.registers[c]) > 255;
						this.registers[b] += this.registers[c];
						this.registers[0xf] = overflow_flag_add;
						break;

					case (5): //SUB Vx, Vy
						let overflow_flag_sub = (this.registers[b] >= this.registers[c]) ? 1 : 0;
						this.registers[b] -= this.registers[c];
						this.registers[0xf] = overflow_flag_sub;
						break;

					case (6): //SHR Vx {, Vy}/
						let lsr_flag = (this.registers[b] & 0x1);
						this.registers[b] = this.registers[c] >> 1;
						this.registers[0xf] = lsr_flag;
						break;

					case (7): //SUBN Vx, Vy
						let overflow_flag_sub2 = (this.registers[c] >= this.registers[b]) ? 1 : 0;
						this.registers[b] = this.registers[c] - this.registers[b];
						this.registers[0xf] = overflow_flag_sub2;
						break;

					case (0xE): // SHL Vx {, Vy}
						let lsl_flag = (this.registers[b] & 0x80) ? 1 : 0;
						this.registers[b] = this.registers[c] << 1;
						this.registers[0xf] = lsl_flag;
						break;

					default:
						console.log("Logical or arithmetic instruction not implemented");
						break;
				}
				break;

			//9xy0 
			case (a == 0x9):// SNE Vx, Vy
				if (this.registers[b] != this.registers[c]) {
					this.PC += 2;
				}
				break;

			//Annn 
			case (a == 0xa): //LD I, addrs
				this.I = bcd;
				break;

			//Bnnn
			case (a == 0xb): // JP V0, addr
				this.PC = bcd + this.registers[0x0];
				break;

			//Cxkk
			case (a == 0xc): // RND Vx, byte
				this.registers[b] = cd & Math.floor(Math.random() * 256);
				break;

			//Dxyn
			case (a == 0xd): //display or draw
				this.draw_pixel(b, c, d);
				break;

			//Exnn //Key input
			case (a == 0xe):
				switch (cd) {
					case (0x9e):
						if (keypressed[this.registers[b]] == 1) {
							this.PC += 2;
							this.PC %= 4096;
						}
						break;

					case (0xa1):
						if (keypressed[this.registers[b]] == 0) {
							this.PC += 2;
							this.PC %= 4096;
						}
						break;

					default:
						console.log("not implemented for 0xe")
						break;

				}
				break;

			//Fnnn
			case (a == 0xf):
				switch (cd) {
					case (0x07):
						this.registers[b] = this.DT;
						break;

					case (0x0A)://get key
						for (let i = 0; i < 16 && this.key_down == false; ++i) {
							if (keypressed[i] == 1) {
								this.registers[b] = i & 0xff;
								this.key_down = true;
								this.key_up = false;
							}
						}

						if (keypressed[this.registers[b]] == 0 && this.key_down == true && this.key_up == false) {
							this.key_up = true;
							this.key_down = false;
						}

						if (this.key_down == false && this.key_up == true) {
							this.key_up = false;
							this.key_down = false;
						} else {
							this.PC -= 2;
						}
						break;

					case (0x15):
						this.DT = this.registers[b];
						break;

					case (0x18):
						this.ST = this.registers[b];
						break;

					case (0x1E):
						this.I += this.registers[b];
						break;

					case (0x29):
						this.I = this.memory[b];
						break;

					case (0x33):
						let number = this.registers[b];

						let a1 = Math.floor(number / 100);
						let b1 = Math.floor(number / 10 % 10);
						let c1 = Math.floor(number % 100) - Math.floor(number / 10 % 10) * 10;

						this.memory[this.I + 0] = a1;
						this.memory[this.I + 1] = b1;
						this.memory[this.I + 2] = c1;
						break;

					case (0x55):
						for (let i = 0; i <= b; i++) {
							this.memory[this.I + i] = this.registers[i]
						}
						this.I += 1;
						break;

					case (0x65):
						for (let i = 0; i <= b; i++) {
							this.registers[i] = this.memory[this.I + i]
						}
						this.I += 1;
						break;

					default:
						console.log("OPCODE for Fnnn not implemented!");
						break;
				}

				break;

			default:
				console.log("OPCODE not implemented!");
				break;
		}
	}
}



//===================================Main======================================

let has_init = false;
let chip8 = new Chip8Interpreter();
draw(chip8.display);

function main() {
	if (RUN) {
		if (!has_init) {
			chip8.load_rom(GLOBAL_ROM);
			has_init = true;
			chip8.clear_screen();
			chip8.should_draw = false;
		}

		for (let j = 0; j < 4; j++) {
			chip8.execute();
		}

		if (chip8.should_draw == true) {
			draw(chip8.display);
			chip8.should_draw = false;
		}
	}
}

document.addEventListener('DOMContentLoaded', function () {
	setInterval(function () {
		main();
	}, 10);
});
