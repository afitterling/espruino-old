/*
  external modules
*/

var Clock = require("clock").Clock;

// BlueTooth Module
function Bluetooth(SerObj, KEYPIN, CMDLIST, BAUD){
  var _baud = BAUD || 38400;
  SerObj.setup(_baud);
  digitalWrite(KEYPIN, 1);
  CMDLIST.forEach(function(cmd){
    SerObj.print(cmd + '\r\n');
  });
  digitalWrite(KEYPIN, 0);
  SerObj.print('AT+RESET\r\n');
}

function BluetoothListener(SerObj, listener){
    SerObj.on('data', listener);
}

/*
  a command translator to map signals to fns
*/
var CommandTranslator = function(CMDTABLE){
  var cmd='';

  function _mapCmds(args){
        CMDTABLE.forEach(function(item){
        if (item.cmd+'' === args[0]){
          // we found the cmd
          item.fn.apply(null, [args[1]]);
        }
      });
  }

  return function listener(data){
    Serial2.print(data);
    cmd+=data;
    var idx = cmd.indexOf("\r");
    digitalPulse(LED2,1, [10]);
    while (idx>=0) {
      var line = cmd.substr(0,idx);
      cmd = cmd.substr(idx+1);
      print(line);
      Serial2.println(line);
      idx = cmd.indexOf("\r");
      _mapCmds(line.split('='));
    }
  };
};

// simple what is says
function InverseState(state){
    return !state;
}

// maps states to Pins and toggles them
function ToggleAbles(PINs, Bools){
  var _state;

  function _output(){
        console.log(Bools);
        PINs.forEach(function(pin){
        digitalWrite(pin, Bools[PINs.indexOf(pin)]);
      });
  }

  return {
    toggle: function(){
      Bools = Bools.map(function(bool){
        return !bool;
      });
      _output();
      _state=!_state;
    },
    on: function(){
      if (!_state){
        Bools = Bools.map(function(bool){
          return !bool;
        });
        _output();
        _state=true;
      }
    },
    off: function(){
      if (_state){
        Bools = Bools.map(function(bool){
          return !bool;
        });
        _output();
        _state=false;
      }
    }
  };
}


/*

   Init

*/


function init(){
  var clk = new Clock();
  
  var mySerial = Serial2;

  var states = {
    // my pump is paradoxically on when 0
    // (relais I ordered at ardafruit is that way)
    pump: new InverseState(false),
    led: false
  };

  var pump = new ToggleAbles([A1, LED1], [states.pump, states.led]);

  /*
    set button watch
  */
  setWatch(
    function(){
      pump.toggle();
    },
    BTN,
    { edge : "rising", repeat : true, debounce : 10 }
  );

  /*
    Bluetooth
  */
  new Bluetooth(mySerial, B1, [
    'AT',
    'AT+UART=38400,0,0',
    'AT+ROLE=1',
    'AT+PSWD=0000',
    'AT+NAME=BLUEBASE']);

  new BluetoothListener(mySerial, new CommandTranslator(
    [
      // clock updater
      {cmd: 'setClock', fn: function(datestring){
        clk.setClock(datestring);
        Serial2.write('set date ' + clk.getDate().toUTCString());
      }},
      {cmd: 'getDate', fn: function(){
        Serial2.write(clk.getDate().toUTCString());
      }},
      //
      {cmd: 'pumpOn', fn: function(ts){
        Serial2.write('watering started');
        pump.on();
        setTimeout(function(){
          pump.off();
        }, ts*1000);
      }},
      // test
      {cmd: 'test', fn: function(param){
        Serial2.write('got test signal with param "'+param+'"');
      }}
    ]
  ));

  digitalPulse(LED2,1, [150, 150,150]);
}

// init
setTimeout(init, 1500);
