class PickleVM {
  constructor(content, envVars, envFuncs) {
    // static properties
    this.content = content;
    this.instructions = [];
    this.envVars = envVars;
    this.envFuncs = envFuncs;
    this.tags = {};
    this.funcEntries = {};
    // dynamic properties
    this._stack = [];
    this._instrPos = 0;
    this._started = false;
    this._shouldPause = false;
    this._shouldReturn = false;
    this._returnValue = undefined;

    this.decodeInstructions();
    this.collectSymbolTables();
  }

  get isRunning() {
    return this._started;
  }

  decodeInstructions() {
    this.content.split('\n').map(line => {
      this.instructions.push(line.split(','));
    });
    // for debug
    //this.instructions.map(instruction => console.log(instruction));
  }

  collectSymbolTables() {
    // collect tags and function entry points
    for (let i = 0; i < this.instructions.length; ++i) {
      let instruction = this.instructions[i];
      if (instruction[0] == 'tag') {
        this.tags[instruction[1]] = i;
      } else if (instruction[0] == 'function') {
        this.funcEntries[instruction[1]] = i;
      }
    }
  }

  setInstrPos(pos) {
    this._instrPos = pos;
  }

  incInstrPos() {
    this._instrPos++;
  }

  locateFunc(funcName) {
    var pos = this.funcEntries[funcName];
    if (pos == undefined) {
      throw new Error(`Cannot find function ${funcName}!`);
    }

    this.setInstrPos(pos+1);
  }

  run() {
    while (!this._shouldReturn && !this._shouldPause) {
      this.runOneInstruction();
      this.incInstrPos();
    }

    if (this._shouldReturn) {
      this._started = false;
      return this._returnValue;
    } else {
      // should pause
      this._shouldPause = false;
      return;
    }
  }

  continue(returnValue) {
    if (!this.isRunning) {
      return new Error('Try to continue when vm is not running!');
    }

    this._stack.push(returnValue);
    this.run();
  }

  runFunc(funcName) {
    // clear all the context
    this._stack = [];
    this._started = true;
    this._shouldPause = false;
    this._shouldReturn = false;
    this._returnValue = undefined;

    this.locateFunc(funcName);

    return this.run();
  }

  runOneInstruction() {
    let instruction = this.instructions[this._instrPos];
    if (instruction[0] == 'tag') {
      // do nothing here
    //--------------------------------------
    // control flow instructions
    //--------------------------------------
    } else if (instruction[0] == 'goto') {
      if (!(instruction[1] in this.tags)) {
        throw new Error(`${instruction[1]} unknown goto tag!`);
      }
      this.setInstrPos(this.tags[instruction[1]]);
    } else if (instruction[0] == 'if_not_goto') {
      if (!(instruction[1] in this.tags)) {
        throw new Error(`${instruction[1]} unknown if_not_goto tag!`);
      }
      let condition = this._stack.pop();
      if (!condition) {
        this.setInstrPos(this.tags[instruction[1]]);
      }
    //--------------------------------------
    // push-to-stack instructions
    //--------------------------------------
    } else if (instruction[0] == 'pushnum') {
      this._stack.push(parseFloat(instruction[1]));
    } else if (instruction[0] == 'pushvar') {
      if (!(instruction[1] in this.envVars)) {
        throw new Error(`${instruction[1]} is not in environment variables!`);
      }
      this._stack.push(this.envVars[instruction[1]]);
    } else if (instruction[0] == 'pushstr') {
      this._stack.push(instruction[1]);
    //--------------------------------------
    // operator instructions
    //--------------------------------------
    } else if (instruction[0] == 'more') {
      let v2 = this._stack.pop();
      let v1 = this._stack.pop();
      this._stack.push(v1 > v2);
    } else if (instruction[0] == 'more_or_eq') {
      let v2 = this._stack.pop();
      let v1 = this._stack.pop();
      this._stack.push(v1 >= v2);
    } else if (instruction[0] == 'less') {
      let v2 = this._stack.pop();
      let v1 = this._stack.pop();
      this._stack.push(v1 < v2);
    } else if (instruction[0] == 'less_or_eq') {
      let v2 = this._stack.pop();
      let v1 = this._stack.pop();
      this._stack.push(v1 <= v2);
    } else if (instruction[0] == 'eq') {
      let v2 = this._stack.pop();
      let v1 = this._stack.pop();
      this._stack.push(v1 == v2);
    } else if (instruction[0] == 'plus') {
      let v2 = this._stack.pop();
      let v1 = this._stack.pop();
      this._stack.push(v1 + v2);
    } else if (instruction[0] == 'minus') {
      let v2 = this._stack.pop();
      let v1 = this._stack.pop();
      this._stack.push(v1 - v2);
    } else if (instruction[0] == 'multiply') {
      let v2 = this._stack.pop();
      let v1 = this._stack.pop();
      this._stack.push(v1 * v2);
    } else if (instruction[0] == 'divide') {
      let v2 = this._stack.pop();
      let v1 = this._stack.pop();
      this._stack.push(v1 / v2);
    //--------------------------------------
    // function-related instructions
    //--------------------------------------
    } else if (instruction[0] == 'function') {
      throw new Error(`${instruction[1]} meet unexpected function!`);
    } else if (instruction[0] == 'call') {
      if (!(instruction[1] in this.envFuncs)) {
        throw new Error(`${instruction[1]} is not in environment functions!`);
      }
      // yeah I know this pieces of code looks terrible 
      // but I haven't find other better soultions yet
      let func = this.envFuncs[instruction[1]].funcImp;
      let returnValue;
      if (func.length == 0) {
        returnValue = func();
      } else if (func.length == 1) {
        var arg1 = this._stack.pop();
        returnValue = func(arg1);
      } else if (func.length == 2) {
        var arg2 = this._stack.pop();
        var arg1 = this._stack.pop();
        returnValue = func(arg1, arg2);
      } else if (func.length == 3) {
        var arg3 = this._stack.pop();
        var arg2 = this._stack.pop();
        var arg1 = this._stack.pop();
        returnValue = func(arg1, arg2, arg3);
      } else {
        throw new Error(`${instruction[1]} has too many params which the vm does not support!`);
      }


      if (this.envFuncs[instruction[1]].pauseAfterComplete) {
        // if function is stoppable, then it should be continue() who return the function value
        this._shouldPause = true;
      } else {
        // otherwise normal return
        this._stack.push(returnValue);
      }
    } else if (instruction[0] == 'return') {
      this._shouldReturn = true;
      this._returnValue = this._stack.pop();
    } else if (instruction[0] == 'function_end') {
      this._shouldReturn = true;
    //--------------------------------------
    // assign instructions
    //--------------------------------------
    } else if (instruction[0] == 'assign') {
      if (!(instruction[1] in this.envVars)) {
        throw new Error(`${instruction[1]} is not in environment variables!`);
      }
      this.envVars[instruction[1]] = this._stack.pop();
    } else {
      throw new Error(`Unknown instruction: ${instruction}`);
    }
    // there shouldn't be any code after this line
  }
}

module.exports = PickleVM;