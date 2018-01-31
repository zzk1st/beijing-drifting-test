//index.js
//获取应用实例
const app = getApp()
const PickleVM = require('../../lib/pickle-vm.js');

var gameUIData = {
  mainText: '',
  leftText: '',
  rightText: '',
};

var content = `
function,main
pushstr,帝都浮生记  第一章
call,showText
pushstr,准备好了吗？
pushstr,让我再想想...
pushstr,快开始吧！
call,select
assign,a
pushvar,a
pushnum,0
eq
if_not_goto,flowtag.0
pushstr,怂包！
call,showText
goto,flowtag.1
tag,flowtag.0
pushstr,你是坠吼滴！
call,showText
tag,flowtag.1
function_end
`;

var gameStats = {
  a: 1,
  b: 2,
  c: 3,
};

var gameFuncs = {
  showText: {
    pauseAfterComplete: true,
    funcImp: {},
  },
  select: {
    pauseAfterComplete: true,
    funcImp: {},
  },
};

var vm = new PickleVM(content, gameStats, gameFuncs);
var self;

Page({
  data: gameUIData,
  clickLeft: function(event) {
    vm.continue(0);
  },
  clickRight: function(event) {
    vm.continue(1);
  },
  onShow: function() {
    function showTextFunc(text) {
      selectFunc(text, '继续...', '继续...');
    }

    function selectFunc(mainText, leftText, rightText) {
      self.setData({
        mainText: mainText,
        leftText: leftText,
        rightText: rightText,
      });
    }
    
    self = this;
    gameFuncs.showText.funcImp = showTextFunc;
    gameFuncs.select.funcImp = selectFunc;

    vm.runFunc('main');
  },
});
