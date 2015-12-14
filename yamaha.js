//<YAMAHA_AV cmd="GET"><USB><List_Info>GetParam</List_Info></USB></YAMAHA_AV>
//<YAMAHA_AV cmd="GET"><USB><Play_Info>GetParam</Play_Info></USB></YAMAHA_AV>

// The Module Constructor, needs the ip as parameter : e.g. new Yamaha("192.168.0.15")

/**
 * The Yamaha Module Constructor.
 * @constructor
 * @param {object} options - Options object
 * @param {string} options.ip - The ip of the yamaha receiver.
 * @param {string} options.responseDelay - The delay of the response for put commands, in seconds - defaults to 1. Better than polling...
 * @param {string} options.zones - Number of zones supported by receiver, including main zone
 * @param {string} options.activeZone - Currently active zone
 *
 */
function Yamaha(options) {
    this.ip = '192.168.1.2';
    this.zones = 2;
    this.activeZone = 1;
    this.responseDelay = 0;

    for (var param in options) {
        if (options.hasOwnProperty(param) && (this.hasOwnProperty(param))) {
            this[param] = options[param];
        }
    }

}

/*----------Service methods----------*/

Yamaha.prototype.getZoneName = function (zoneNumber) {
    if(zoneNumber > 1) {
        return 'Zone_'+zoneNumber;
    }
    return 'Main_Zone';
};

Yamaha.prototype.activeZoneName = function () {
    return this.getZoneName(this.activeZone);
};

Yamaha.prototype.createCommand = function (type, container, command) {
    return '<YAMAHA_AV cmd="'+type+'"><' + container + '>' + command + '</' + container + '></YAMAHA_AV>';
};

Yamaha.prototype.createZoneCommand = function (type, zone, command) {
    return this.createCommand(type, this.getZoneName(zone), command);
};

Yamaha.prototype.createActiveZoneCommand = function (type, command) {
    return this.createZoneCommand(this.activeZone, command);
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
                    if(isPutCommand && _self.responseDelay) {
                        setTimeout(function () {
                            resolve(xmlToJSON.parseString(responseText));
                        }, _self.responseDelay);
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


/*----------Service methods end----------*/


/**
 * Switches power of some receiver zone
 * @param zone {Number} - # of zone to switch
 * @param powerOn {Boolean} - if true, turn the receiver on, else turn off
 * @returns {Promise}
 */
Yamaha.prototype.switchPower = function (zone, powerOn) {
    var self = this,
        powerStatus = 'Standby';

    if(powerOn === false) {
        powerStatus = 'On';
    }

    if(!zone) {
        zone = this.activeZone;
    }
    //the receiver needs to be powered on
    //what we should do here is check if it's already on
    return this.isOn(zone).then(function (isOn) {
        //if the receiver is on while we're trying to turn it on, or
        //if the receiver is off while we're trying to turn it off
        if((isOn && powerOn) || (!isOn && !powerOn)) {
            return isOn;
        }
        var command = self.createZoneCommand('PUT', zone, '<Power_Control><Power>'+ powerStatus +'</Power></Power_Control>');
        return self.SendXMLToReceiver(command);
    });
};

/**
 * Power on some receiver zone
 * @param zone {Boolean} - # of zone to turn on
 * @returns {Promise}
 */
Yamaha.prototype.powerOn = function (zone) {
    return this.switchPower(zone, true);
};

/**
 * Power off some receiver zone
 * @param zone {Boolean} - # of zone to turn on
 * @returns {Promise}
 */
Yamaha.prototype.powerOff = function (zone) {
    return this.switchPower(zone, false);
};

/**
 * Power on all receiver zones
 * @returns {Promise}
 */
Yamaha.prototype.powerOnAll = function () {
    var self = this,
        i, promise;
    //loop through all zones and power them on (one by one, NOT simultaneously)
    promise = this.powerOn(1);
    for(i=2;i<=this.zones;i++) {
        promise = promise.then(this.powerOn(i));
    }
    return promise;
};

/**
 * Power off all receiver zones
 * @returns {Promise}
 */
Yamaha.prototype.powerOffAll = function () {
    var self = this,
        i, promise;
    //loop through all zones and power them on (one by one, NOT simultaneously)
    promise = this.powerOff(1);
    for(i=2;i<=this.zones;i++) {
        promise = promise.then(this.powerOff(i));
    }
    return promise;
};

/**
 *
 * @param to {Number} change volume of the active zone to value (generally from -800 (min - -80.0 db) to 165 (+16.5 db))
 * @returns {Promise}
 */
Yamaha.prototype.setVolumeTo = function (to) {
    var command = this.createActiveZoneCommand('PUT', '<Volume><Lvl><Val>' + to + '</Val><Exp>1</Exp><Unit>dB</Unit></Lvl></Volume>');
    return this.SendXMLToReceiver(command);
};

/**
 *
 * @param by {Number} increase volume of the active zone by the given value (this value will be summed to the current volume)
 * @returns {Promise}
 */
Yamaha.prototype.volumeUp = function (by) {
    return this.adjustVolumeBy(by);
};

/**
 *
 * @param by {Number} decrease volume of the active zone by the given value (this value will be deducted to the current volume)
 * @returns {Promise}
 */
Yamaha.prototype.volumeDown = function (by) {
    return this.adjustVolumeBy(-by);
};

/**
 *
 * @param by {Number} change volume of the active zone by the given value (this value, either positive or negative) will be summed to the current volume)
 * @returns {Promise}
 */
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

/**
 * Sets the input of the active zone
 * @param {String} to name of input, e.g. "NET RADIO"
 */
Yamaha.prototype.setInputTo = function (to) {
    var command;
    command = this.createActiveZoneCommand('PUT', '<Input><Input_Sel>' + to + '</Input_Sel></Input>');
    return this.SendXMLToReceiver(command);
};

/**
 * Gets the basic info about the currenly active zone
 * @returns {Promise}
 */
Yamaha.prototype.getBasicInfo = function () {
    var _self = this,
        command = this.createZoneCommand('GET', '<Basic_Status>GetParam</Basic_Status>');
    return this.SendXMLToReceiver(command).then(function (basicInfo) {
        return basicInfo.YAMAHA_AV[0][_self.activeZoneName()][0].Basic_Status[0];
    });
};

/**
 * Gets the volume level (from -800 to 165)
 * @returns {Promise}
 */
Yamaha.prototype.getVolume = function () {
    return this.getBasicInfo().then(function (basicStatus) {
        return parseInt(basicStatus.Volume[0].Lvl[0].Val[0]._text);
    })
};

/**
 * Gets the mute state (boolean)
 * @returns {Promise}
 */
Yamaha.prototype.isMuted = function () {
    return this.getBasicInfo().then(function (basicStatus) {
        return parseInt(basicStatus.Volume[0].Mute[0]._text !== "Off");
    })
};

/**
 * Gets the zone state (boolean)
 * @returns {Promise}
 */
Yamaha.prototype.isOn = function () {
    return this.getBasicInfo().then(function (basicStatus) {
        return parseInt(basicStatus.Power_Control[0].Power[0]._text === "On");
    })
};

/**
 * Gets current input name (string)
 * @returns {Promise}
 */
Yamaha.prototype.getCurrentInput = function () {
    return this.getBasicInfo().then(function (basicStatus) {
        return parseInt(basicStatus.Input[0].Input_Sel[0]._text);
    });
};

/**
 * Gets pure direct state (boolean)
 * @returns {Promise}
 */
Yamaha.prototype.isPureDirectEnabled = function () {
    return this.getBasicInfo().then(function (basicStatus) {
        return parseInt(basicStatus.Sound_Video[0].Pure_Direct[0].Mode[0]._text === "On");
    });
};

/**
 * Gets party mode state (boolean)
 * @returns {Promise}
 */
Yamaha.prototype.isPartyModeEnabled = function () {
    return this.getBasicInfo().then(function (basicStatus) {
        try {
            return basicStatus.Party_Info[0]._text === "On";
        }
            //this means getting the property of undefined, so the party mode is not supported by the receiver
        catch (err) {
            return false;
        }
    });
};

/**
 * Get common system info (Object)
 * @returns {Promise}
 */
Yamaha.prototype.getSystemConfig = function () {
    var command = this.createCommand('GET', 'System', '<Config>GetParam</Config>');
    return this.SendXMLToReceiver(command);
};


/**
 * Get all available inputs for this receiver.
 * We should probably use them to check input availability before changing inputs
 * @returns {Promise}
 */
Yamaha.prototype.getAvailableInputs = function () {
    this.getSystemConfig().then(function (systemConfig) {
        var inputs = [],
        inputsXML = systemConfig.YAMAHA_AV.System[0].Config[0].Name[0].Input[0];
        for (var prop in inputsXML) {
            if(inputsXML.hasOwnProperty(prop)) {
                inputs.push(inputsXML[prop][0]);
            }
        }
        return inputs;
    });
};

/**
 * Select one item from the list.
 * Yamaha receivers currently support items from 1 to 8
 * @param input - input to get the list from
 * @param number - # of item (1 to 8)
 * @returns {Promise}
 */
Yamaha.prototype.selectItem = function (input, number) {
    var command = this.createCommand('PUT', input, '<List_Control><Direct_Sel>Line_' + number + '</Direct_Sel></List_Control>');
    return this.SendXMLToReceiver(command);
};

/**
 * Get the list of items for one of the inputs
 * @param input - input name
 * @returns {Promise}
 */
Yamaha.prototype.getList = function (input) {
    var command = this.createCommand('GET', input, '<List_Info>GetParam</List_Info>');
    return this.SendXMLToReceiver(command).then(function (result) {
        return enrichListInfo(result, input);
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

Yamaha.prototype.selectUSBListItem = function (number) {
    return this.selectItem("USB", number);
};

Yamaha.prototype.selectWebRadioListItem = function (number) {
    var _self = this;
    return this.selectItem("NET_RADIO", number).then(function(result) {
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