//<YAMAHA_AV cmd="GET"><USB><List_Info>GetParam</List_Info></USB></YAMAHA_AV>
//<YAMAHA_AV cmd="GET"><USB><Play_Info>GetParam</Play_Info></USB></YAMAHA_AV>

// The Module Constructor, needs the ip as parameter : e.g. new Yamaha("192.168.0.15")

/**
 * The Yamaha Module Constructor.
 * @constructor
 * @param {string} ip - The ip of the yamaha receiver.
 * @param {number} responseDelay - The delay of the response for put commands, in seconds - defaults to 1. Better than polling...
 *
 */
function Yamaha(ip, responseDelay) {
    if (typeof responseDelay == 'string' || responseDelay instanceof String) responseDelay = parseInt(responseDelay);
    if (!responseDelay) responseDelay = 1;
    this.ip = ip;
    this.responseDelay = responseDelay;
}

Yamaha.prototype.powerOn = function () {
    var self = this;
    //the receiver needs to be powered on
    //what we should do here is check if it's already on
    return this.isOn().then(function (isOn) {
        if(isOn) {
            return false;
        }
        var command = '<YAMAHA_AV cmd="PUT"><Main_Zone><Power_Control><Power>On</Power></Power_Control></Main_Zone></YAMAHA_AV>';
        return self.SendXMLToReceiver(command);
    });

};

Yamaha.prototype.powerOff = function (to) {
    var command = '<YAMAHA_AV cmd="PUT"><Main_Zone><Power_Control><Power>Standby</Power></Power_Control></Main_Zone></YAMAHA_AV>';
    return this.SendXMLToReceiver(command);
};


Yamaha.prototype.setVolumeTo = function (to) {
    var command = '<YAMAHA_AV cmd="PUT"><Main_Zone><Volume><Lvl><Val>' + to + '</Val><Exp>1</Exp><Unit>dB</Unit></Lvl></Volume></Main_Zone></YAMAHA_AV>';
    return this.SendXMLToReceiver(command);
};

Yamaha.prototype.volumeUp = function (by) {
    return this.adjustVolumeBy(by);
};

Yamaha.prototype.volumeDown = function (by) {
    return this.adjustVolumeBy(-by);
};

Yamaha.prototype.adjustVolumeBy = function (by) {
    var self = this;
    //what we need to do here is get the basic info about the receiver, then change the volume by the given number
    //number can be either positive or negative
    if (typeof by == 'string' || by instanceof String) {
        by = parseInt(by);
    }
    //return instantly resolved promise for chaining if the delta is zero or NaN (or any other bad value)
    if(!by || !by instanceof Number) {
        return new Promise().resolve();
    }

    return this.getBasicInfo().then(function (basicInfo) {
        return self.setVolumeTo(basicInfo.getVolume() + by);
    });
};

Yamaha.prototype.setMainInputTo = function (to) {
    return this.setInputTo("Main_Zone", to);
};

Yamaha.prototype.setInputTo = function (zone, to) {
    var command = '<YAMAHA_AV cmd="PUT"><' + zone + '><Input><Input_Sel>' + to + '</Input_Sel></Input></' + zone + '></YAMAHA_AV>';
    return this.SendXMLToReceiver(command);
};

Yamaha.prototype.SendXMLToReceiver = function (bodyText) {
    var _self = this;
    return new Promise(function (resolve, reject) {
        var request = new XMLHttpRequest();
        var url = 'http://' + _self.ip + '/YamahaRemoteControl/ctrl';
        var isPutCommand = bodyText.indexOf("cmd=\"PUT\"" >= 0);

        request.onreadystatechange = function () {
            if (this.readyState == 4) {
                if (this.status == 200) {
                    var responseText = this.responseText;
                    if(isPutCommand) {
                        setTimeout(function () {
                            resolve(xmlToJSON.parseString(responseText));
                        }, _self.responseDelay * 1000);
                    }
                    else {
                        resolve(this.responseText);
                    }
                }
                else {
                    var error = new Error(this.statusText);
                    error.code = this.status;
                    reject(error);
                }
            }
        };

        request.onerror = function() {
            reject(new Error("Network Error"));
        };

        request.open("POST", url, true);
        request.send(bodyText);
    });
};

Yamaha.prototype.getBasicInfo = function () {

    var command = '<YAMAHA_AV cmd="GET"><Main_Zone><Basic_Status>GetParam</Basic_Status></Main_Zone></YAMAHA_AV>';
    return this.SendXMLToReceiver(command).then(function (result) {
        return enrichBasicStatus(result);
    });

};

function enrichBasicStatus(basicStatus) {
    //I assume YAMAHA_AV can be either object or array (depending on the receiver model)
    //let's check it out and act accordingly
    var yamahaAv = basicStatus.YAMAHA_AV[0];

    basicStatus.getVolume = function () {
        return parseInt(yamahaAv.Main_Zone[0].Basic_Status[0].Volume[0].Lvl[0].Val[0]._text);
    };

    basicStatus.isMuted = function () {
        return yamahaAv.Main_Zone[0].Basic_Status[0].Volume[0].Mute[0]._text !== "Off";
    };

    basicStatus.isOn = function () {
        return yamahaAv.Main_Zone[0].Basic_Status[0].Power_Control[0].Power[0]._text === "On";
    };

    basicStatus.isOff = function () {
        return !basicStatus.isOn();
    };

    basicStatus.getCurrentInput = function () {
        return yamahaAv.Main_Zone[0].Basic_Status[0].Input[0].Input_Sel[0]._text;
    };

    basicStatus.isPartyModeEnabled = function () {
        var basicStatus = yamahaAv.Main_Zone[0].Basic_Status[0];
        try {
            return yamahaAv.Main_Zone[0].Basic_Status[0].Party_Info[0]._text === "On";
        }
        //this means getting the property of undefined, so the party mode is not supported by the receiver
        catch (err) {
            return false;
        }
    };

    basicStatus.isPureDirectEnabled = function () {
        console.log(yamahaAv.Main_Zone[0].Basic_Status[0].Sound_Video[0].Pure_Direct[0].Mode[0]._text);
        return yamahaAv.Main_Zone[0].Basic_Status[0].Sound_Video[0].Pure_Direct[0].Mode[0]._text === "On";
    };
    return basicStatus;
}


// Add direct functions for basic info
function addBasicInfoWrapper(basicInfoName) {
    Yamaha.prototype[basicInfoName] = function () {
        return this.getBasicInfo().then(function(basicInfo) {
            return basicInfo[basicInfoName]();
        });
    };
}
//TODO: no list, take properties of basicStatus object
var basicInfos = ["getVolume", "isMuted", "isOn", "isOff", "getCurrentInput", "isPartyModeEnabled", "isPureDirectEnabled"],
    i, basicInfo;
for (i = 0; i < basicInfos.length; i++) {
    basicInfo = basicInfos[i];
    addBasicInfoWrapper(basicInfo);
}

Yamaha.prototype.getSystemConfig = function () {
    var command = '<YAMAHA_AV cmd="GET"><System><Config>GetParam</Config></System></YAMAHA_AV>';
    return this.SendXMLToReceiver(command);
};

Yamaha.prototype.getAvailableInputs = function () {
    this.getSystemConfig().then(function (result) {
        var inputs = [],
        inputsXML = result.YAMAHA_AV.System[0].Config[0].Name[0].Input[0];
        for (var prop in inputsXML) {
            if(inputsXML.hasOwnProperty(prop)) {
                inputs.push(inputsXML[prop][0]);
            }
        }
        return inputs;
    });
};

Yamaha.prototype.selectListItem = function (listname, number) {
    var command = '<YAMAHA_AV cmd="PUT"><' + listname + '><List_Control><Direct_Sel>Line_' + number + '</Direct_Sel></List_Control></' + listname + '></YAMAHA_AV>';
    return this.SendXMLToReceiver(command);
};

Yamaha.prototype.getList = function (name) {
    var command = '<YAMAHA_AV cmd="GET"><' + name + '><List_Info>GetParam</List_Info></' + name + '></YAMAHA_AV>';
    return this.SendXMLToReceiver(command).then(function (result) {
        return enrichListInfo(result, name);
    });
};

function enrichListInfo(listInfo, listname) {
    //I assume YAMAHA_AV can be either object or array (depending on the receiver model)
    //let's check it out and act accordingly
    var yamahaAv;
    if(listInfo.YAMAHA_AV instanceof Array) {
        yamahaAv = listInfo.YAMAHA_AV[0];
    }
    else {
        yamahaAv = listInfo.YAMAHA_AV;
    }


    listInfo.hasSelectableItems = function () {
        return yamahaAv[listname][0].List_Info[0].Current_List[0].Line_1[0].Attribute[0]._text !== "Unselectable";
    };

    listInfo.isFolder = function (itemNumber) {
        if(!itemNumber) {
            itemNumber = 1;
        }
        return yamahaAv[listname][0].List_Info[0].Current_List[0]['Line_'+itemNumber][0].Attribute[0]._text === "Container";
    };

    listInfo.isItem = function (itemNumber) {
        if(!itemNumber) {
            itemNumber = 1;
        }
        return yamahaAv[listname][0].List_Info[0].Current_List[0]['Line_'+itemNumber][0].Attribute[0]._text === "Item";
    };

    listInfo.isReady = function () {
        return !listInfo.isBusy() && listInfo.hasSelectableItems();
    };

    listInfo.isBusy = function () {
        return yamahaAv[listname][0].List_Info[0].Menu_Status[0]._text === "Busy";
    };

    listInfo.getMenuLayer = function () {
        return yamahaAv[listname][0].List_Info[0].Menu_Layer[0]._text;
    };

    listInfo.getMenuName = function () {
        return yamahaAv[listname][0].List_Info[0].Menu_Name[0]._text;
    };

    listInfo.getList = function () {
        return yamahaAv[listname][0].List_Info[0];
    };
    return listInfo;
}


Yamaha.prototype.isMenuReady = function (name) {
    return this.getList(name).then(function (result) {
        return result.isReady();
    });
};

Yamaha.prototype.whenMenuReady = function (name) {
    var self = this;
    return self.when("isMenuReady", name, true);
};

/**
 * long polling of any request made to the receiver
 * @param YamahaCall - the metod name to be called
 * @param parameter - argument to pass to the above method
 * @param expectedReturnValue - stop polling when this value meets our requirements
 * @returns {Promise}
 */
Yamaha.prototype.when = function (YamahaCall, parameter, expectedReturnValue) {
    var self = this;
    return new Promise(function (resolve, reject) {
        var tries = 0;
        var interval = setInterval(function () {
            self[YamahaCall](parameter).then(function (result) {
                if (result == expectedReturnValue) {
                    clearInterval(interval);
                    resolve();
                }
                tries++;
                if (tries > 40) reject("Timeout");
            });

        }, 500);
    });
};

Yamaha.prototype.selectUSBListItem = function (number) {
    return this.selectListItem("USB", number);
};

Yamaha.prototype.selectWebRadioListItem = function (number) {
    var _self = this;
    return this.selectListItem("NET_RADIO", number).then(function(result) {
        return _self.getWebRadioList();
    });
};

Yamaha.prototype.selectFirstPlayableWebRadioListItem = function() {
    var onListReceived = function (list) {
        var _self = this;
        if(list.hasSelectableItems()) {
            if(list.isItem(1)) {
                this.selectWebRadioListItem(1);
            }
            else {
                return this.selectFirstPlayableWebRadioListItem();
            }
        }
        else {
            return false;
        }
    }.bind(this);

    return this.selectWebRadioListItem(1).then(onListReceived);
};

Yamaha.prototype.getWebRadioList = function () {
    return this.getList("NET_RADIO");
};
Yamaha.prototype.getUSBList = function () {
    return this.getList("USB");
};

//-----------chained commands-------------

//Turns the receiver on and selects the first radio on the list (if any)
Yamaha.prototype.switchToFavoriteNumber = function(number){
    return this.setMainInputTo("NET RADIO")
        .then(this.selectFirstPlayableWebRadioListItem());
};