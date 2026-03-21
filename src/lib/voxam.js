// Voxam - JavaScript implementation of the Z-Machine (versions 1-3).
// This program is in the public domain.

"use strict";

const Voxam_Version = {
  major: 2,
  minor: 0,
  subminor: 2,
  timestamp: 1480624305074,
};

function Voxam(arr) {
  var mem;
  mem = this.memInit = new Uint8Array(arr);
  this.version = mem[0];
  if (this.version < 1 || this.version > 3)
    throw new Error("Unsupported Z-code version.");
  this.byteSwapped = !!(mem[1] & 1);
  this.statusType = !!(mem[1] & 2);
  this.serial = String.fromCharCode(...mem.slice(18, 24));
  this.zorkid =
    (mem[2] << (this.byteSwapped ? 0 : 8)) |
    (mem[3] << (this.byteSwapped ? 8 : 0));
}

Voxam.prototype = {
  byteSwapped: false,
  constructor: Voxam,
  version: 3,
  deserialize: function (saveData) {
    var evalStack, i, j, callStack, pc, dataView, purbot, offset;
    var read8, read16s, read16, read24, read32;
    read8 = () => saveData[offset++];
    read16s = () => ((offset += 2), dataView.getInt16(offset - 2));
    read16 = () => ((offset += 2), dataView.getUint16(offset - 2));
    read24 = () => ((offset += 3), dataView.getUint32(offset - 4) & 0xffffff);
    read32 = () => ((offset += 4), dataView.getUint32(offset - 4));
    try {
      offset = purbot = this.getu(14);
      dataView = new DataView(saveData.buffer);
      // ZORKID does not match
      if (saveData[2] != this.mem[2] || saveData[3] != this.mem[3]) return null;
      pc = read32();
      callStack = new Array(read16());
      evalStack = Array.from({ length: read16() }, read16s);
      for (i = 0; i < callStack.length; i++) {
        callStack[i] = {};
        callStack[i].local = new Int16Array(read8());
        callStack[i].pc = read24();
        callStack[i].evalStack = Array.from({ length: read16() }, read16s);
        for (j = 0; j < callStack[i].local.length; j++)
          callStack[i].local[j] = read16s();
      }
      this.mem.set(new Uint8Array(saveData.buffer, 0, purbot));
      return [evalStack, callStack, pc];
    } catch (e) {
      return null;
    }
  },
  endText: 0,
  abbrevAddr: null,
  genPrint: function* (text) {
    var x = this.get(16);
    if (x != this.savedFlags) {
      this.savedFlags = x;
      yield* this.highlight(!!(x & 2));
    }
    yield* this.print(text, !!(x & 1));
  },
  get: function (x) {
    return this.view.getInt16(x, this.byteSwapped);
  },
  getText: function (addr) {
    var decodeZChar;
    var output = "";
    var permShift = 0;
    var tempShift = 0;
    var word;
    var aux;
    // Alphabet table
    // v1 has no newline in A2 and includes '<', v2+ have newline
    var alphabet =
      this.version == 1
        ? "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ*0123456789.,!?_#'\"/\\<-:()"
        : "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ*\n0123456789.,!?_#'\"/\\-:()";
    decodeZChar = (zchar) => {
      if (tempShift == 3) {
        aux = zchar << 5;
        tempShift = 4;
      } else if (tempShift == 4) {
        aux += zchar;
        if (aux == 13) output += "\n";
        else if (aux) output += String.fromCharCode(aux);
        tempShift = permShift;
      } else if (tempShift == 5) {
        output += this.getText(
          this.getu(this.abbrevAddr + (aux + zchar) * 2) * 2,
        );
        tempShift = permShift;
      } else if (zchar == 0) {
        output += " ";
      } else if (zchar == 1 && this.version == 1) {
        // In v1, z-char 1 prints newline directly
        output += "\n";
      } else if (this.version == 1) {
        // v1: no abbreviations, shifts at 2-5
        if (zchar == 6 && tempShift == 2) {
          // A2 escape sequence for 10-bit character
          tempShift = 3;
        } else if (zchar >= 6) {
          // Regular alphabet character
          output += alphabet[tempShift * 26 + zchar - 6];
          tempShift = permShift;
        } else if (zchar == 2 || zchar == 3) {
          // Temp shift: rotate from current permanent alphabet
          // z-char 2: A0→A1, A1→A2, A2→A0
          // z-char 3: A0→A2, A1→A0, A2→A1
          tempShift = (permShift + (zchar == 2 ? 1 : 2)) % 3;
        } else if (zchar == 4 || zchar == 5) {
          // Shift-lock: rotate from current permanent alphabet
          permShift = tempShift = (permShift + (zchar == 4 ? 1 : 2)) % 3;
        }
      } else if (this.version == 2) {
        // v2: 1 abbreviation table, shifts at 2-5
        if (zchar == 6 && tempShift == 2) {
          // A2 escape sequence for 10-bit character
          tempShift = 3;
        } else if (zchar == 1) {
          // Abbreviation
          tempShift = 5;
          aux = 0;
        } else if (zchar >= 6) {
          // Regular alphabet character
          output += alphabet[tempShift * 26 + zchar - 6];
          tempShift = permShift;
        } else if (zchar == 2 || zchar == 3) {
          // Temp shift: rotate from current permanent alphabet
          // z-char 2: A0→A1, A1→A2, A2→A0
          // z-char 3: A0→A2, A1→A0, A2→A1
          tempShift = (permShift + (zchar == 2 ? 1 : 2)) % 3;
        } else if (zchar == 4 || zchar == 5) {
          // Shift-lock: rotate from current permanent alphabet
          permShift = tempShift = (permShift + (zchar == 4 ? 1 : 2)) % 3;
        }
      } else {
        // v3: 3 abbreviation tables, shifts at 4-5
        if (zchar < 4) {
          tempShift = 5;
          aux = (zchar - 1) * 32;
        } else if (zchar < 6) {
          if (!tempShift) tempShift = zchar - 3;
          else if (tempShift == zchar - 3) permShift = tempShift;
          else permShift = tempShift = 0;
        } else if (zchar == 6 && tempShift == 2) {
          tempShift = 3;
        } else {
          output += alphabet[tempShift * 26 + zchar - 6];
          tempShift = permShift;
        }
      }
    };
    for (;;) {
      word = this.getu(addr);
      addr += 2;
      decodeZChar((word >> 10) & 31);
      decodeZChar((word >> 5) & 31);
      decodeZChar(word & 31);
      if (word & 32768) break;
    }
    this.endText = addr;
    return output;
  },
  getu: function (x) {
    return this.view.getUint16(x, this.byteSwapped);
  },
  handleInput: function (str, textAddr, lexAddr) {
    var i, words, truncateWord;
    // Put text
    str = str.toLowerCase().slice(0, this.mem[textAddr] - 1);
    for (i = 0; i < str.length; i++)
      this.mem[textAddr + i + 1] = str.charCodeAt(i);
    this.mem[textAddr + str.length + 1] = 0;
    // Lex text - v1 has '<' in A2, v2+ don't
    var punctPattern =
      this.version == 1 ? /[0-9.,!?_#'"\/\\<:\-()]/ : /[0-9.,!?_#'"\/\\:\-()]/;
    truncateWord = (x) => (
      (i = 0),
      x
        .split("")
        .filter(
          (y) => (i += /[a-z]/.test(y) ? 1 : punctPattern.test(y) ? 2 : 4) < 7,
        )
        .join("")
    );
    words = JSON.parse(
      "[" +
        str
          .replace(
            this.regBreak,
            (m, o) =>
              ",[" +
              m.length +
              "," +
              (this.vocabulary.get(truncateWord(m)) || 0) +
              "," +
              (o + 1) +
              "]",
          )
          .slice(1) +
        "]",
    );
    i = this.mem[lexAddr + 1] = words.length;
    while (i--) {
      this.putu(lexAddr + i * 4 + 2, words[i][1]);
      this.mem[lexAddr + i * 4 + 4] = words[i][0];
      this.mem[lexAddr + i * 4 + 5] = words[i][2];
    }
  },
  highlight: () => [],
  isTandy: false,
  mem: null,
  memInit: null,
  parseVocab: function (s) {
    this.vocabulary = new Map();

    if (s === 0) {
      // If the story file does not contain a dictionary
      // use the default word separators and early exit.
      this.regBreak = new RegExp("[^ \\n\\t]+", "g");
      return;
    }

    var e;
    var n;
    n = this.mem[s++];
    e = this.selfInsertingBreaks = String.fromCharCode(
      ...this.mem.slice(s, s + n),
    );
    e =
      e
        .split("")
        .map((x) => (x.toUpperCase() == x.toLowerCase() ? "" : "\\") + x)
        .join("") + "]";
    this.regBreak = new RegExp("[" + e + "|[^ \\n\\t" + e + "+", "g");
    s += n;
    e = this.mem[s++];
    n = this.get(s);
    s += 2;
    while (n--) {
      this.vocabulary.set(this.getText(s), s);
      s += e;
    }
  },
  print: () => [],
  put: function (x, y) {
    return this.view.setInt16(x, y, this.byteSwapped);
  },
  putu: function (x, y) {
    return this.view.setUint16(x, y & 65535, this.byteSwapped);
  },
  read: () => [],
  regBreak: null,
  restarted: () => [],
  restore: () => [],
  run: function* () {
    var mem,
      pc,
      callStack,
      evalStack,
      op0,
      op1,
      op2,
      op3,
      operandCount,
      flags,
      inst,
      x,
      y,
      z;
    var globals, objects, abbrevAddr, defaultProps;
    var addr,
      fetch,
      flagset,
      init,
      move,
      opfetch,
      pcfetch,
      pcget,
      pcgetb,
      pcgetu,
      predicate,
      propfind,
      ret,
      store,
      xfetch,
      xstore;

    // Functions
    addr = (x) => (x & 65535) << 1;
    fetch = (x) => {
      if (x == 0) return evalStack.pop();
      if (x < 16) return callStack[0].local[x - 1];
      return this.get(globals + 2 * x);
    };
    flagset = () => {
      op3 = 1 << (15 & ~op1);
      op2 = objects + op0 * 9 + (op1 & 16 ? 2 : 0);
      flags = this.get(op2);
    };
    const initRng = () => {
      this.seed = (Math.random() * 0xffffffff) >>> 0;
    };
    init = () => {
      mem = this.mem = new Uint8Array(this.memInit);
      this.view = new DataView(mem.buffer);
      mem[1] &= 3;
      if (this.isTandy) mem[1] |= 8;
      if (!this.updateStatusLine) mem[1] |= 16;
      if (this.screen && this.split) mem[1] |= 32;
      this.put(16, this.savedFlags);
      if (!this.vocabulary) this.parseVocab(this.getu(8));
      defaultProps = this.getu(10) - 2;
      globals = this.getu(12) - 32;
      this.abbrevAddr = abbrevAddr = this.getu(24);
      callStack = [];
      evalStack = [];
      pc = this.getu(6);
      objects = defaultProps + 55;
      initRng();
    };
    move = (x, y) => {
      var w, z;
      // Remove from old FIRST-NEXT chain
      if ((z = mem[objects + x * 9 + 4])) {
        if (mem[objects + z * 9 + 6] == x) {
          // is x.loc.first=x?
          // x.loc.first=x.next
          mem[objects + z * 9 + 6] = mem[objects + x * 9 + 5];
        } else {
          // z=x.loc.first
          z = mem[objects + z * 9 + 6];
          while (z != x) {
            w = z;
            // z=z.next
            z = mem[objects + z * 9 + 5];
          }
          // w.next=x.next
          mem[objects + w * 9 + 5] = mem[objects + x * 9 + 5];
        }
      }
      // Insert at beginning of new FIRST-NEXT chain
      if ((mem[objects + x * 9 + 4] = y)) {
        // x.loc=y
        // x.next=y.first
        mem[objects + x * 9 + 5] = mem[objects + y * 9 + 6];
        // y.first=x
        mem[objects + y * 9 + 6] = x;
      } else {
        // x.next=0
        mem[objects + x * 9 + 5] = 0;
      }
    };
    opfetch = (x, y) => {
      if ((x &= 3) == 3) return;
      operandCount = y;
      return [pcget, pcgetb, pcfetch][x]();
    };
    pcfetch = (x) => fetch(mem[pc++]);
    pcget = () => {
      pc += 2;
      return this.get(pc - 2);
    };
    pcgetb = () => mem[pc++];
    pcgetu = () => {
      pc += 2;
      return this.getu(pc - 2);
    };
    predicate = (p) => {
      var x = pcgetb();
      if (x & 128) p = !p;
      if (x & 64) x &= 63;
      else x = ((x & 63) << 8) | pcgetb();
      if (p) return;
      if (x == 0 || x == 1) return ret(x);
      if (x & 0x2000) x -= 0x4000;
      pc += x - 2;
    };
    propfind = () => {
      var z = this.getu(objects + op0 * 9 + 7);
      z += mem[z] * 2 + 1;
      while (mem[z]) {
        if ((mem[z] & 31) == op1) {
          op3 = z + 1;
          return true;
        } else {
          z += (mem[z] >> 5) + 2;
        }
      }
      op3 = 0;
      return false;
    };
    ret = (x) => {
      evalStack = callStack[0].evalStack;
      pc = callStack[0].pc;
      callStack.shift();
      store(x);
    };
    store = (y) => {
      var x = pcgetb();
      if (x == 0) evalStack.push(y);
      else if (x < 16) callStack[0].local[x - 1] = y;
      else this.put(globals + 2 * x, y);
    };
    xfetch = (x) => {
      if (x == 0) return evalStack[evalStack.length - 1];
      if (x < 16) return callStack[0].local[x - 1];
      return this.get(globals + 2 * x);
    };
    xstore = (x, y) => {
      if (x == 0) evalStack[evalStack.length - 1] = y;
      else if (x < 16) callStack[0].local[x - 1] = y;
      else this.put(globals + 2 * x, y);
    };

    // Initializations
    init();
    yield* this.restarted();
    yield* this.highlight(!!(this.savedFlags & 2));

    // Main loop
    main: for (;;) {
      inst = pcgetb();
      if (inst < 128) {
        // 2OP
        if (inst & 64) op0 = pcfetch();
        else op0 = pcgetb();
        if (inst & 32) op1 = pcfetch();
        else op1 = pcgetb();
        inst &= 31;
        operandCount = 2;
      } else if (inst < 176) {
        // 1OP
        x = (inst >> 4) & 3;
        inst &= 143;
        if (x == 0) op0 = pcget();
        else if (x == 1) op0 = pcgetb();
        else if (x == 2) op0 = pcfetch();
      } else if (inst >= 192) {
        // EXT
        x = pcgetb();
        op0 = opfetch(x >> 6, 1);
        op1 = opfetch(x >> 4, 2);
        op2 = opfetch(x >> 2, 3);
        op3 = opfetch(x >> 0, 4);
        if (inst < 224) inst &= 31;
      }
      switch (inst) {
        case 1: // EQUAL?
          predicate(
            op0 == op1 ||
              (operandCount > 2 && op0 == op2) ||
              (operandCount == 4 && op0 == op3),
          );
          break;
        case 2: // LESS?
          predicate(op0 < op1);
          break;
        case 3: // GRTR?
          predicate(op0 > op1);
          break;
        case 4: // DLESS?
          xstore(op0, (x = xfetch(op0) - 1));
          predicate(x < op1);
          break;
        case 5: // IGRTR?
          xstore(op0, (x = xfetch(op0) + 1));
          predicate(x > op1);
          break;
        case 6: // IN?
          predicate(mem[objects + op0 * 9 + 4] == op1);
          break;
        case 7: // BTST
          predicate((op0 & op1) == op1);
          break;
        case 8: // BOR
          store(op0 | op1);
          break;
        case 9: // BAND
          store(op0 & op1);
          break;
        case 10: // FSET?
          flagset();
          predicate(flags & op3);
          break;
        case 11: // FSET
          flagset();
          this.put(op2, flags | op3);
          break;
        case 12: // FCLEAR
          flagset();
          this.put(op2, flags & ~op3);
          break;
        case 13: // SET
          xstore(op0, op1);
          break;
        case 14: // MOVE
          move(op0, op1);
          break;
        case 15: // GET
          store(this.get((op0 + op1 * 2) & 65535));
          break;
        case 16: // GETB
          store(mem[(op0 + op1) & 65535]);
          break;
        case 17: // GETP
          if (propfind()) store(mem[op3 - 1] & 32 ? this.get(op3) : mem[op3]);
          else store(this.get(defaultProps + 2 * op1));
          break;
        case 18: // GETPT
          propfind();
          store(op3);
          break;
        case 19: // NEXTP
          if (op1) {
            // Return next property
            propfind();
            store(mem[op3 + (mem[op3 - 1] >> 5) + 1] & 31);
          } else {
            // Return first property
            x = this.getu(objects + op0 * 9 + 7);
            store(mem[x + mem[x] * 2 + 1] & 31);
          }
          break;
        case 20: // ADD
          store(op0 + op1);
          break;
        case 21: // SUB
          store(op0 - op1);
          break;
        case 22: // MUL
          store(Math.imul(op0, op1));
          break;
        case 23: // DIV
          store(Math.trunc(op0 / op1));
          break;
        case 24: // MOD
          store(op0 % op1);
          break;
        case 128: // ZERO?
          predicate(!op0);
          break;
        case 129: // NEXT?
          store((x = mem[objects + op0 * 9 + 5]));
          predicate(x);
          break;
        case 130: // FIRST?
          store((x = mem[objects + op0 * 9 + 6]));
          predicate(x);
          break;
        case 131: // LOC
          store(mem[objects + op0 * 9 + 4]);
          break;
        case 132: // PTSIZE
          store((mem[(op0 - 1) & 65535] >> 5) + 1);
          break;
        case 133: // INC
          x = xfetch(op0);
          xstore(op0, x + 1);
          break;
        case 134: // DEC
          x = xfetch(op0);
          xstore(op0, x - 1);
          break;
        case 135: // PRINTB
          yield* this.genPrint(this.getText(op0 & 65535));
          break;
        case 137: // REMOVE
          move(op0, 0);
          break;
        case 138: // PRINTD
          yield* this.genPrint(
            this.getText(this.getu(objects + op0 * 9 + 7) + 1),
          );
          break;
        case 139: // RETURN
          ret(op0);
          break;
        case 140: // JUMP
          pc += op0 - 2;
          break;
        case 141: // PRINT
          yield* this.genPrint(this.getText(addr(op0)));
          break;
        case 142: // VALUE
          store(xfetch(op0));
          break;
        case 143: // BCOM
          store(~op0);
          break;
        case 176: // RTRUE
          ret(1);
          break;
        case 177: // RFALSE
          ret(0);
          break;
        case 178: // PRINTI
          yield* this.genPrint(this.getText(pc));
          pc = this.endText;
          break;
        case 179: // PRINTR
          yield* this.genPrint(this.getText(pc) + "\n");
          ret(1);
          break;
        case 180: // NOOP
          break;
        case 181: // SAVE
          this.savedFlags = this.get(16);
          predicate(yield* this.save(this.serialize(evalStack, callStack, pc)));
          break;
        case 182: // RESTORE
          this.savedFlags = this.get(16);
          if ((z = yield* this.restore())) z = this.deserialize(z);
          this.put(16, this.savedFlags);
          if (z) ((evalStack = z[0]), (callStack = z[1]), (pc = z[2]));
          predicate(z);
          break;
        case 183: // RESTART
          init();
          yield* this.restarted();
          break;
        case 184: // RSTACK
          ret(evalStack[evalStack.length - 1]);
          break;
        case 185: // FSTACK
          evalStack.pop();
          break;
        case 186: // QUIT
          return;
        case 187: // CRLF
          yield* this.genPrint("\n");
          break;
        case 188: // USL
          if (this.updateStatusLine)
            yield* this.updateStatusLine(
              this.getText(this.getu(objects + xfetch(16) * 9 + 7) + 1),
              xfetch(18),
              xfetch(17),
            );
          break;
        case 189: // VERIFY
          predicate(this.verify());
          break;
        case 224: // CALL
          if (op0) {
            x = mem[(op0 = addr(op0))];
            callStack.unshift({
              evalStack: evalStack,
              pc: pc,
              local: new Int16Array(x),
            });
            evalStack = [];
            pc = op0 + 1;
            for (x = 0; x < mem[op0]; x++) callStack[0].local[x] = pcget();
            if (operandCount > 1 && mem[op0] > 0) callStack[0].local[0] = op1;
            if (operandCount > 2 && mem[op0] > 1) callStack[0].local[1] = op2;
            if (operandCount > 3 && mem[op0] > 2) callStack[0].local[2] = op3;
          } else {
            store(0);
          }
          break;
        case 225: // PUT
          this.put((op0 + op1 * 2) & 65535, op2);
          break;
        case 226: // PUTB
          mem[(op0 + op1) & 65535] = op2;
          break;
        case 227: // PUTP
          propfind();
          if (mem[op3 - 1] & 32) this.put(op3, op2);
          else mem[op3] = op2;
          break;
        case 228: // READ
          yield* this.genPrint("");
          if (this.updateStatusLine)
            yield* this.updateStatusLine(
              this.getText(this.getu(objects + xfetch(16) * 9 + 7) + 1),
              xfetch(18),
              xfetch(17),
            );
          this.handleInput(
            yield* this.read(mem[op0 & 65535]),
            op0 & 65535,
            op1 & 65535,
          );
          break;
        case 229: // PRINTC
          yield* this.genPrint(
            op0 == 13 ? "\n" : op0 ? String.fromCharCode(op0) : "",
          );
          break;
        case 230: // PRINTN
          yield* this.genPrint(String(op0));
          break;
        case 231: // RANDOM
          if (op0 <= 0) {
            // If 'op0' is non-positive, reseed the PRNG.
            if (op0 === 0) {
              // If 0, seed using Math.random().
              initRng();
            } else {
              // If negative, seed with the specified value.
              this.seed = op0 >>> 0;
            }
            store(0); // Reseeding always returns 0.
            break;
          }
          // Linear congruential generator
          this.seed = (1664525 * this.seed + 1013904223) >>> 0;
          // Return integer in range [1..op0] (inclusive).
          store(Math.floor((this.seed / 0xffffffff) * op0) + 1);
          break;
        case 232: // PUSH
          evalStack.push(op0);
          break;
        case 233: // POP
          xstore(op0, evalStack.pop());
          break;
        case 234: // SPLIT
          if (this.split) yield* this.split(op0);
          break;
        case 235: // SCREEN
          if (this.screen) yield* this.screen(op0);
          break;
        default:
          throw new Error("Voxam: Invalid Z-machine opcode");
      }
    }
  },
  save: () => [],
  savedFlags: 0,
  selfInsertingBreaks: null,
  serial: null,
  serialize: function (evalStack, callStack, pc) {
    var i, j, offset, saveData, dataView;
    offset = this.getu(14); // PURBOT
    i =
      offset +
      callStack.reduce(
        (p, c) => p + 2 * (c.evalStack.length + c.local.length) + 6,
        0,
      ) +
      2 * evalStack.length +
      8;
    saveData = new Uint8Array(i);
    saveData.set(new Uint8Array(this.mem.buffer, 0, offset));
    dataView = new DataView(saveData.buffer);
    dataView.setUint32(offset, pc);
    dataView.setUint16(offset + 4, callStack.length);
    dataView.setUint16(offset + 6, evalStack.length);
    for (i = 0; i < evalStack.length; i++)
      dataView.setInt16(offset + i * 2 + 8, evalStack[i]);
    offset += evalStack.length * 2 + 8;
    for (i = 0; i < callStack.length; i++) {
      dataView.setUint32(offset, callStack[i].pc);
      dataView.setUint8(offset, callStack[i].local.length);
      dataView.setUint16(offset + 4, callStack[i].evalStack.length);
      for (j = 0; j < callStack[i].evalStack.length; j++)
        dataView.setInt16(offset + j * 2 + 6, callStack[i].evalStack[j]);
      for (j = 0; j < callStack[i].local.length; j++)
        dataView.setInt16(
          offset + callStack[i].evalStack.length * 2 + j * 2 + 6,
          callStack[i].local[j],
        );
      offset +=
        (callStack[i].evalStack.length + callStack[i].local.length) * 2 + 6;
    }
    return saveData;
  },
  screen: null,
  split: null,
  statusType: null,
  updateStatusLine: null,
  verify: function () {
    var plenth = this.getu(26);
    var pchksm = this.getu(28);
    var i = 64;
    while (i < plenth * 2) pchksm = (pchksm - this.memInit[i++]) & 65535;
    return !pchksm;
  },
  view: null,
  vocabulary: null,
  zorkid: null,
};

Voxam.version = Voxam_Version;

try {
  if (module && module.exports) module.exports = Voxam;
} catch (e) {}

export default Voxam;
