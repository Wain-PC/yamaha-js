//<YAMAHA_AV cmd="GET"><USB><List_Info>GetParam</List_Info></USB></YAMAHA_AV>
//<YAMAHA_AV cmd="GET"><USB><Play_Info>GetParam</Play_Info></USB></YAMAHA_AV>

// The Module Constructor, needs the ip as parameter : e.g. new Yamaha("192.168.0.15")

/**
 * The Yamaha Module Constructor.
 * @constructor
 * @param {object} options - Options object
 * @param {string} options.ip - The ip of the yamaha receiver.
 * @param {string} options.zones - Number of zones supported by receiver, including main zone
 *
 */
function Yamaha(options) {
    this.ip = '192.168.1.2';
    this.zones = 2;
    this.currentList = null;

    for (var param in options) {
        if (options.hasOwnProperty(param) && (this.hasOwnProperty(param))) {
            this[param] = options[param];
        }
    }

    for (method in this.__proto__) {
        if (this.__proto__.hasOwnProperty(method) && typeof this.__proto__[method] === 'function') {
            this[method] = this[method].bind(this);
        }
    }

    for (var method in this.list) {
        if (this.list.hasOwnProperty(method)) {
            this.list[method] = this.list[method].bind(this);
        }
    }
    for (method in this.tuner) {
        if (this.tuner.hasOwnProperty(method)) {
            this.tuner[method] = this.tuner[method].bind(this);
        }
    }

    for (method in this.network) {
        if (this.network.hasOwnProperty(method)) {
            this.network[method] = this.network[method].bind(this);
        }
    }

    //here go the codes for each button on the remote. I hope they're model independent
    //one can use them as this.codes[zoneNumber][codeName]
    this.codes = {
        //codes for zone 1 (Main zone)
        1: {
            //numeric codes
            '1': '7F0151AE',
            '2': '7F0152AD',
            '3': '7F0153AC',
            '4': '7F0154AB',
            '5': '7F0155AA',
            '6': '7F0156A9',
            '7': '7F0157A8',
            '8': '7F0158A7',
            '9': '7F0159A6',
            '0': '7F015AA5',
            '+10': '7F015BA4',
            'ENT': '7F015CA3',

            //operations codes
            'Play': '7F016897',
            'Stop': '7F016996',
            'Pause': '7F016798',
            'Search-': '7F016A95',
            'Search+': '7F016E94',
            'Skip-': '7F016C93',
            'Skip+': '7F016D92',
            'FM': '7F015827',
            'AM': '7F01552A',

            //cursor codes
            'Up': '7A859D62',
            'Down': '7A859C63',
            'Left': '7A859F60',
            'Right': '7A859E61',
            'Enter': '7A85DE21',
            'Return': '7A85AA55',
            'Level': '7A858679',
            'On Screen': '7A85847B',
            'Option': '7A856B14',
            'Top Menu': '7A85A0DF',
            'Pop Up Menu': '7A85A4DB'

        },
        //codes for zone 2
        2: {
            //numeric codes
            '1': '7F01718F',
            '2': '7F01728C',
            '3': '7F01738D',
            '4': '7F01748A',
            '5': '7F01758B',
            '6': '7F017688',
            '7': '7F017789',
            '8': '7F017886',
            '9': '7F017986',
            '0': '7F017A84',
            '+10': '7F017B85',
            'ENT': '7F017C82',

            //operations codes
            'Play': '7F018876',
            'Stop': '7F018977',
            'Pause': '7F018779',
            'Search-': '7F018A74',
            'Search+': '7F018B75',
            'Skip-': '7F018C72',
            'Skip+': '7F018D73',
            'FM': '7F015927',
            'AM': '7F015628',

            //cursor codes
            'Up': '7A852B55',
            'Down': '7A852C52',
            'Left': '7A852D53',
            'Right': '7A852E50',
            'Enter': '7A852F51',
            'Return': '7A853C42',
            'Option': '7A856C12',
            'Top Menu': '7A85A1DF',
            'Pop Up Menu': '7A85A5DB'

        }
    };
}

/*----------Service methods----------*/

Yamaha.prototype.getZoneName = function (zoneNumber) {
    if (zoneNumber > 1) {
        return 'Zone_' + zoneNumber;
    }
    return 'Main_Zone';
};

Yamaha.prototype._createCommand = function (type, container, command) {
    return '<YAMAHA_AV cmd="' + type + '"><' + container + '>' + command + '</' + container + '></YAMAHA_AV>';
};

Yamaha.prototype._createZoneCommand = function (type, zone, command) {
    return this._createCommand(type, zone, command);
};

Yamaha.prototype._sendXMLToReceiver = function (bodyText) {
    var _self = this;
    return new Promise(function (resolve, reject) {
        var request = new XMLHttpRequest();
        var url = 'http://' + _self.ip + '/YamahaRemoteControl/ctrl';

        request.onreadystatechange = function () {
            if (this.readyState == 4) {
                if (this.status == 200) {
                    var responseText = this.responseText;
                    resolve(xmlToJSON.parseString(responseText));
                }
                else {
                    var error = new Error(this.statusText);
                    error.code = this.status;
                    reject(error);
                }
            }
        };

        request.onerror = function () {
            reject(new Error("Network Error"));
        };

        request.open("POST", url, true);
        request.send(bodyText);
    });
};

/**
 * Simply gets 'On' or 'Off' caption, depending on the incoming state
 * @param {Boolean} state
 * @returns {string}
 * @private
 */
Yamaha.prototype._getOnOffCaption = function (state) {
    return state === true ? 'On' : 'Off';
};

/**
 *
 * @param zone
 * @param commandType
 * @param commandName
 * @private
 * @returns {Promise}
 */
Yamaha.prototype._sendCode = function (zone, commandType, commandName) {
    if (zone > 1) {
        zone = 2;
    }
    else {
        zone = 1;
    }
    var command = this._createCommand('PUT', 'System', '<Misc><Remote_Signal><Receive><Code>' + this.codes[zone][commandName] + '</Code></Receive></Remote_Signal></Misc>');
    return this._sendXMLToReceiver(command);
};

Yamaha.prototype._traverse = function (xmlObject, traverseArray, getTextNode) {
    var i = 0, length = traverseArray.length,
        result = JSON.parse(JSON.stringify(xmlObject));

    //walk through YAMAHA_AV if present
    if (result['YAMAHA_AV'] && result['YAMAHA_AV'][0]) {
        result = result['YAMAHA_AV'][0];
    }
    try {
        for (i; i < length; i++) {
            result = result[traverseArray[i]][0];
            if (result === undefined) {
                return {};
            }

        }

        if (getTextNode) {
            if (result && result.hasOwnProperty('_text') && typeof result['_text'] !== 'object') {
                return result['_text'];
            }
            else {
                return null;
            }
        }
        return result;
    }
    catch (err) {
        return null;
    }
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

    if (powerOn === true) {
        powerStatus = 'On';
    }

    //the receiver needs to be powered on
    //what we should do here is check if it's already on
    return this.isOn(zone).then(function (isOn) {
        //if the receiver is on while we're trying to turn it on, or
        //if the receiver is off while we're trying to turn it off
        if ((isOn && powerOn) || (!isOn && !powerOn)) {
            return isOn;
        }
        var command = self._createZoneCommand('PUT', zone, '<Power_Control><Power>' + powerStatus + '</Power></Power_Control>');
        return self._sendXMLToReceiver(command);
    });
};

/**
 * Power on some receiver zone
 * @param zone {Number} - # of zone to turn on
 * @returns {Promise}
 */
Yamaha.prototype.powerOn = function (zone) {
    return this.switchPower(zone, true);
};

/**
 * Power off some receiver zone
 * @param zone {Number} - # of zone to turn on
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
    var i, promise;
    //loop through all zones and power them on (one by one, NOT simultaneously)
    promise = this.powerOn(1);
    for (i = 2; i <= this.zones; i++) {
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
    for (i = 2; i <= this.zones; i++) {
        promise = promise.then(this.powerOff(i));
    }
    return promise;
};

/**
 *
 * @param zone {String} Zone ID
 * @param to {Number} change volume of the active zone to value (generally from -800 (min - -80.0 db) to 165 (+16.5 db))
 * @returns {Promise}
 */
Yamaha.prototype.setVolume = function (zone, to) {
    var command = this._createZoneCommand('PUT', zone, '<Volume><Lvl><Val>' + to * 10 + '</Val><Exp>1</Exp><Unit>dB</Unit></Lvl></Volume>');
    return this._sendXMLToReceiver(command);
};

/**
 * @param zone {String} Zone ID
 * @param by {Number} increase volume of the active zone by the given value (this value will be summed to the current volume)
 * @returns {Promise}
 */
Yamaha.prototype.volumeUp = function (zone, by) {
    return this.adjustVolumeBy(zone, by);
};

/**
 * @param zone {String} Zone ID
 * @param by {Number} decrease volume of the active zone by the given value (this value will be deducted to the current volume)
 * @returns {Promise}
 */
Yamaha.prototype.volumeDown = function (zone, by) {
    return this.adjustVolumeBy(zone, -by);
};

/**
 * @param zone {String} Zone ID
 * @param by {Number} change volume of the active zone by the given value (this value, either positive or negative) will be summed to the current volume)
 * @returns {Promise}
 */
Yamaha.prototype.adjustVolumeBy = function (zone, by) {
    var self = this;
    //what we need to do here is get the basic info about the receiver, then change the volume by the given number
    //number can be either positive or negative
    if (typeof by == 'string' || by instanceof String) {
        by = parseInt(by);
    }
    //return instantly resolved promise for chaining if the delta is zero or NaN (or any other bad value)
    if (!by || !by instanceof Number) {
        return new Promise().resolve();
    }

    return this.getBasicInfo(zone).then(function (basicInfo) {
        return self.setVolume(self._getVolume(basicInfo) + by);
    });
};

/**
 * Sets the input of the active zone
 * @param {String} zone Zone ID, e.g "Main_Zone" or "Zone_2"
 * @param {String} to name of input, e.g. "NET RADIO"
 */
Yamaha.prototype.setInputTo = function (zone, to) {
    var command;
    command = this._createZoneCommand('PUT', zone, '<Input><Input_Sel>' + to + '</Input_Sel></Input>');
    return this._sendXMLToReceiver(command);
};

/**
 * Gets the basic info about the currenly active zone
 * @returns {Promise}
 */
Yamaha.prototype.getBasicInfo = function (zone, prettyJson) {
    var _self = this,
        command = this._createZoneCommand('GET', zone, '<Basic_Status>GetParam</Basic_Status>');
    return this._sendXMLToReceiver(command).then(function (basicInfo) {
        var info = _self._traverse(basicInfo, [zone, 'Basic_Status']);
        if (prettyJson) {
            return {
                isOn: _self._isOn(info),
                sleep: _self._getSleep(info),
                currentVolume: _self._getVolume(info),
                isMuted: _self._isMuted(info),
                currentInput: _self._getCurrentInput(info),
                currentSoundProgram: _self._getCurrentSoundProgram(info),
                pureDirect: _self._isPureDirectEnabled(info),
                partyMode: _self._isPartyModeEnabled(info),
                enhancer: _self._isEnhancerEnabled(info)
            };
        }
        return info;
    });
};

/**
 *
 * @param {String} zone Zone ID, e.g "Main_Zone" or "Zone_2"
 * @param {Boolean} muteState - if true, zone will be muted, else it'll be unmuted
 * @returns {Promise}
 */
Yamaha.prototype.setMute = function (zone, muteState) {
    var command = this._createZoneCommand('PUT', zone, '<Volume><Mute>' + this._getOnOffCaption(muteState) + '</Mute></Volume>');
    return this._sendXMLToReceiver(command);
};

Yamaha.prototype.setSleep = function (zone, sleepTimer) {
    var command = this._createZoneCommand('PUT', zone, '<Power_Control><Sleep>' + sleepTimer + '</Sleep></Power_Control>');
    return this._sendXMLToReceiver(command);
};

Yamaha.prototype.getSleep = function (zone) {
    return this.getBasicInfo(zone).then(this._getSleep);
};
Yamaha.prototype._getSleep = function (basicStatus) {
    return this._traverse(basicStatus, ['Power_Control', 'Sleep'], true);
};


Yamaha.prototype._getVolume = function (basicStatus) {
    return this._traverse(basicStatus, ['Volume', 'Lvl', 'Val'], true) / 10;
};
/**
 * Gets the volume level (from -800 to 165)
 * @returns {Promise}
 */
Yamaha.prototype.getVolume = function (zone) {
    return this.getBasicInfo(zone).then(this._getVolume);
};


Yamaha.prototype._isMuted = function (basicStatus) {
    return this._traverse(basicStatus, ['Volume', 'Mute'], true) !== 'Off';
};
/**
 * Gets the mute state (boolean)
 * @returns {Promise}
 */
Yamaha.prototype.isMuted = function (zone) {
    return this.getBasicInfo(zone).then(this._isMuted);
};

Yamaha.prototype._isOn = function (basicStatus) {
    return this._traverse(basicStatus, ['Power_Control', 'Power'], true) === 'On';
};
/**
 * Gets the zone state (boolean)
 * @returns {Promise}
 */
Yamaha.prototype.isOn = function (zone) {
    return this.getBasicInfo(zone).then(this._isOn);
};

Yamaha.prototype._getCurrentInput = function (basicStatus) {
    return this._traverse(basicStatus, ['Input', 'Input_Sel'], true);
};

Yamaha.prototype._isEnhancerEnabled = function (basicStatus) {
    return this._traverse(basicStatus, ['Surround', 'Program_Sel', 'Current', 'Enhancer'], true) === 'On';
};

Yamaha.prototype._getCurrentSoundProgram = function (basicStatus) {
    return this._traverse(basicStatus, ['Surround', 'Program_Sel', 'Current', 'Sound_Program'], true);
};
/**
 * Gets current input name (string)
 * @returns {Promise}
 */
Yamaha.prototype.getCurrentInput = function (zone) {
    return this.getBasicInfo(zone).then(this._getCurrentInput);
};

Yamaha.prototype._isPureDirectEnabled = function (basicStatus) {
    return this._traverse(basicStatus, ['Sound_Video', 'Pure_Direct', 'Mode'], true) === 'On';
};

/**
 * Gets pure direct state (boolean)
 * @returns {Promise}
 */
Yamaha.prototype.isPureDirectEnabled = function (zone) {
    return this.getBasicInfo(zone).then(this._isPureDirectEnabled);
};

Yamaha.prototype._isPartyModeEnabled = function (basicStatus) {
    try {
        return this._traverse(basicStatus, ['Party_Info'], true) === 'On';
    }
        //this means getting the property of undefined, so the party mode is not supported by the receiver
    catch (err) {
        return null;
    }
};

/**
 * Gets party mode state (boolean)
 * @returns {Promise}
 */
Yamaha.prototype.isPartyModeEnabled = function (zone) {
    return this.getBasicInfo(zone).then(this._isPartyModeEnabled());
};

/**
 * Get common system info (Object)
 * @returns {Promise}
 */
Yamaha.prototype.getSystemConfig = function (prettyJson) {
    var command = this._createCommand('GET', 'System', '<Config>GetParam</Config>'),
        _self = this;
    return this._sendXMLToReceiver(command).then(function (systemConfig) {
        systemConfig = this._traverse(systemConfig, ['System', 'Config']);
        if (prettyJson) {
            return {
                availableZones: _self._getAvailableZones(systemConfig),
                modelName: this._traverse(systemConfig, ['Model_Name'], true),
                systemId: this._traverse(systemConfig, ['System_ID'], true),
                version: this._traverse(systemConfig, ['Version'], true)
            }
        }
        return systemConfig;
    }.bind(this));
};


/**
 * Get common system info (Object)
 * @returns {Promise}
 */
Yamaha.prototype.getSystemServiceInfo = function () {
    var command = this._createCommand('GET', 'System', '<Service><Info>GetParam</Info></Service>');
    return this._sendXMLToReceiver(command);
};

/**
 * Get config for some zone (Object)
 * @returns {Promise}
 */
Yamaha.prototype.getZoneConfig = function (zone, prettyJson) {
    var command = this._createCommand('GET', zone, '<Config>GetParam</Config>'),
        _self = this,
        retObj = {},
        sceneName,
        scenes;
    return this._sendXMLToReceiver(command).then(function (zoneConfig) {
        zoneConfig = this._traverse(zoneConfig, [zone, 'Config']);
        if (prettyJson) {
            retObj = {
                isReady: this._traverse(zoneConfig, ['Feature_Availability'], true) === 'Ready',
                volumeExistence: this._traverse(zoneConfig, ['Volume_Existence'], true) === 'Exists',
                name: this._traverse(zoneConfig, ['Name', 'Zone'], true),
                scenes: []
            };

            if (zoneConfig.Name[0].Scene && (scenes = zoneConfig.Name[0].Scene[0])) {

                for (sceneName in scenes) {
                    if (scenes.hasOwnProperty(sceneName)) {
                        retObj.scenes.push(scenes[sceneName][0]._text);
                    }
                }
            }
            return retObj;

        }
        return zoneConfig;
    }.bind(this));
};

/**
 * Get all available inputs for this receiver.
 * We should probably use them to check input availability before changing inputs
 * @returns {Promise}
 */
Yamaha.prototype.getAvailableInputs = function (zone) {
    var command = this._createZoneCommand('GET', zone, '<Input><Input_Sel_Item>GetParam</Input_Sel_Item></Input>');
    return this._sendXMLToReceiver(command).then(function (data) {
        var inputsArray = this._traverse(data, [zone, 'Input', 'Input_Sel_Item']),
            inputObj, inputName, outputArray = [];
        for (inputName in inputsArray) {
            if (inputsArray.hasOwnProperty(inputName)) {
                inputObj = {
                    id: this._traverse(inputsArray, [inputName, 'Src_Name'], true) || this._traverse(inputsArray, [inputName, 'Param'], true),
                    name: this._traverse(inputsArray, [inputName, 'Title'], true)
                };
                outputArray.push(inputObj);
            }
        }
        return outputArray;
    }.bind(this));
};


Yamaha.prototype._getAvailableZones = function (systemConfig) {
    var inputs = [],
        features = this._traverse(systemConfig, ['Feature_Existence']);
    for (var feature in features) {
        if (features.hasOwnProperty(feature) && (feature === 'Main_Zone' || feature.indexOf('Zone_') === -0) && this._traverse(features, [feature], true) === 1) {
            inputs.push(feature);
        }
    }
    return inputs;
};

/**
 * Get all available zones(and features) for this receiver.
 * @returns {Promise}
 */
Yamaha.prototype.getAvailableZones = function () {
    return this.getSystemConfig().then(this._getAvailableZones);
};

//----------SOUND SETTINGS BEGIN----------

Yamaha.prototype.getSurroundMode = function () {
    //TODO: add method body here
};

Yamaha.prototype.setSurroundMode = function (mode) {
    var zone = 'Main_Zone';
    var command = this._createZoneCommand('PUT', zone, '<Surr><Pgm_Sel>' + mode + '</Pgm_Sel></Surr>');
    return this._sendXMLToReceiver(command);
};

Yamaha.prototype.setScene = function (sceneNumber) {
    var zone = 'Main_Zone';
    var command = this._createZoneCommand('PUT', zone, '<Scene><Scene_Sel>Scene ' + sceneNumber + '</Scene_Sel></Scene>');
    return this._sendXMLToReceiver(command);
};

Yamaha.prototype.setBassLevel = function (bassLevel) {
    var zone = 'Main_Zone';
    var command = this._createZoneCommand('PUT', zone, '<Sound_Video><Tone><Bass><Val>' + bassLevel + '</Val><Exp>1</Exp><Unit>dB</Unit></Bass></Tone></Sound_Video>');
    return this._sendXMLToReceiver(command);
};

Yamaha.prototype.setTrebleLevel = function (trebleLevel) {
    var zone = 'Main_Zone';
    var command = this._createZoneCommand('PUT', zone, '<Sound_Video><Tone><Treble><Val>' + trebleLevel + '</Val><Exp>1</Exp><Unit>dB</Unit></Treble></Tone></Sound_Video>');
    return this._sendXMLToReceiver(command);
};

Yamaha.prototype.setEnhancer = function (enhancerState) {
    var zone = 'Main_Zone';
    var command = this._createZoneCommand('PUT', zone, '<Surround><Program_Sel><Current><Enhancer>' + this._getOnOffCaption(enhancerState) + '</Enhancer></Current></Program_Sel></Surround>');
    return this._sendXMLToReceiver(command);
};
Yamaha.prototype.setPureDirect = function (pureDirectState) {
    var zone = 'Main_Zone';
    var command = this._createZoneCommand('PUT', zone, '<Sound_Video><Pure_Direct><Mode>' + this._getOnOffCaption(pureDirectState) + '</Mode></Pure_Direct></Sound_Video>');
    return this._sendXMLToReceiver(command);
};

//----------SOUND SETTINGS END---------

//----------LIST METHODS BEGIN----------

Yamaha.prototype.list = {};

/**
 * Get the list of items for one of the inputs. AFAIK, it's applicable only to WEB_RADIO and USB inputs
 * The list will wait for ready status before returning the result
 * @param input - input name
 * @returns {Promise}
 */
Yamaha.prototype.list.get = function (input) {
    var _self = this,
        command = this._createCommand('GET', input, '<List_Info>GetParam</List_Info>');
    return this._sendXMLToReceiver(command).then(function (listInfo) {
        _self.currentList = _self._traverse(listInfo, [input, 'List_Info']);
        if (_self.list.isReady(_self.currentList)) {
            return _self.list.parse(_self.currentList);
        }
        else {
            //TODO: this should stop after N iterations. Infinite cycles are bad for your PC's health.
            return Promise.resolve().then(_self.list.get.bind(_self, input));
        }
    });
};

Yamaha.prototype.list.parse = function () {
    var _self = this;
    var retObj = {
            list: [],
            header: '',
            level: 1,
            numItems: 0
        },
        list = _self._traverse(_self.currentList, ['Current_List']),
        listItem, listItemName, type,
        i, currentPage, maxPage, promise;

    //get each item from the list
    for (listItemName in list) {
        if (list.hasOwnProperty(listItemName)) {
            listItem = _self._traverse(list, [listItemName]);
            //type can be on of the following: "Item", "Container", "Unselectable"
            type = _self._traverse(listItem, ['Attribute'], true);
            if (type !== 'Unselectable') {
                retObj.list.push({
                    type: type === 'Item' ? 0 : 1,
                    name: _self._traverse(listItem, ['Txt'], true)
                });
            }
        }
    }
    //get list header
    retObj.header = _self._traverse(_self.currentList, ['Menu_Name'], true);
    //get list level
    retObj.level = _self._traverse(_self.currentList, ['Menu_Layer'], true);
    //get number of items in the list
    retObj.numItems = _self._traverse(_self.currentList, ['Cursor_Position', 'Max_Line'], true);
    //get cursorPosition
    retObj.cursorPosition = _self._traverse(_self.currentList, ['Cursor_Position', 'Current_Line'], true);
    return retObj;
};

Yamaha.prototype.list.prevPage = function (input) {
    var command = this._createCommand('PUT', input, '<List_Control><Page>Up</Page></List_Control>');
    return this._sendXMLToReceiver(command);
};


Yamaha.prototype.list.nextPage = function (input) {
    var command = this._createCommand('PUT', input, '<List_Control><Page>Down</Page></List_Control>');
    return this._sendXMLToReceiver(command);
};

/**
 * Checks if the current list has selectable items
 * @returns {boolean}
 */
Yamaha.prototype.list.hasSelectableItems = function () {
    return this._traverse(this.currentList, ['Current_List', 'Line_1', 'Attribute'], true) !== "Unselectable";
};

/**
 * Checks if list item is a folder, so we will get another list if this item will be selected
 * @returns {boolean}
 */
Yamaha.prototype.list.itemIsFolder = function (list, itemNumber) {
    return this._traverse(this.currentList, ['Current_List', 'Line_' + itemNumber, 'Attribute'], true) === "Container"
};

/**
 * Checks if list item is a folder, so it will be played when selected
 * @returns {boolean}
 */
Yamaha.prototype.list.itemIsItem = function (list, itemNumber) {
    return this._traverse(this.currentList, ['Current_List', 'Line_' + itemNumber, 'Attribute'], true) === "Item"
};

/**
 * Checks if the list state is "Ready"
 * @returns {boolean}
 */
Yamaha.prototype.list.isReady = function (list) {
    if (!list) {
        list = this.currentList;
    }
    return this._traverse(this.currentList, ['Menu_Status'], true) === "Ready";
};


/**
 * Select one item from the list.
 * Yamaha receivers currently support items from 1 to 8
 * @param input - input to get the list from
 * @param itemNumber - # of item (1 to 8)
 * @returns {Promise}
 */
Yamaha.prototype.list.selectItem = function (input, itemNumber) {
    var command;
    if(itemNumber<1) {
        itemNumber = 1;
    }
    if(itemNumber>8) {
        itemNumber = 8;
    }
    command = this._createCommand('PUT', input, '<List_Control><Direct_Sel>Line_' + itemNumber + '</Direct_Sel></List_Control>');
    return this._sendXMLToReceiver(command);
};
/**
 * Selects the item on the list (experimental API)
 * @returns {Promise}
 */
Yamaha.prototype.list.jumpLine = function (input, itemNumber) {

    var command = this._createCommand('PUT', input, '<List_Control><Jump_Line>' + itemNumber + '</Jump_Line></List_Control>');
    return this._sendXMLToReceiver(command);
};
/**
 * Goes one level higher on the list
 * @returns {Promise}
 */
Yamaha.prototype.list.back = function (input) {
    //<YAMAHA_AV cmd="PUT"><NET_RADIO><List_Control><Cursor>Return</Cursor></List_Control></NET_RADIO></YAMAHA_AV>
    var command = this._createCommand('PUT', input, '<List_Control><Cursor>Return</Cursor></List_Control>');
    return this._sendXMLToReceiver(command);
};

//----------LIST METHODS END----------

//----------TUNER METHODS BEGIN----------

Yamaha.prototype.tuner = {};

Yamaha.prototype.tuner._sanitizeMode = function (mode) {
    if (mode !== 'AM' && mode !== 'FM') {
        mode = 'FM';
    }
    return mode;
};

Yamaha.prototype.tuner.setMode = function (zone, mode) {
    mode = this.tuner._sanitizeMode(mode);
    var command = this._createZoneCommand('PUT', zone, '<Tuner><Play_Control><Tuning><Band>' + mode + '</Band></Tuning></Play_Control></Tuner>');
    return this._sendXMLToReceiver(command);
};

Yamaha.prototype.tuner.selectPrevPreset = function (zone) {
    var command = this._createZoneCommand('PUT', zone, '<Tuner><Play_Control><Preset><Preset_Sel>Up</Preset_Sel></Preset></Play_Control></Tuner>');
    return this._sendXMLToReceiver(command);
};

Yamaha.prototype.tuner.selectNextPreset = function (zone) {
    var command = this._createZoneCommand('PUT', zone, '<Tuner><Play_Control><Preset><Preset_Sel>Up</Preset_Sel></Preset></Play_Control></Tuner>');
    return this._sendXMLToReceiver(command);
};


Yamaha.prototype.tuner.setFrequency = function (mode, frequency) {
    mode = this.tuner._sanitizeMode(mode);
    if (mode === 'FM') {
        frequency = frequency * 100;
    }
    var command = this._createZoneCommand('PUT', zone, '<Tuner><Play_Control><Tuning><Freq><' + mode + '><Val>' + frequency + '</Val></' + mode + '></Freq></Tuning></Play_Control></Tuner>');
    return this._sendXMLToReceiver(command);
};

//----------TUNER METHODS END------------


//----------NETWORK METHODS BEGIN

Yamaha.prototype.network = {};

Yamaha.prototype.network._createCommand = function (type, command) {
    return this._createCommand('GET', 'System', '<Misc><Network><' + command + '>GetParam</' + command + '></Network></Misc>');
};

Yamaha.prototype.network.getName = function () {
    var command = this.network._createCommand('GET', 'Network_Name');
    return this._sendXMLToReceiver(command).then(function (response) {
        return this._traverse(response, ['System', 'Misc', 'Network', 'Network_Name'], true)
    }.bind(this));
};

Yamaha.prototype.network.getStandby = function () {
    var command = this.network._createCommand('GET', 'Network_Standby');
    return this._sendXMLToReceiver(command).then(function (response) {
        return this._traverse(response, ['System', 'Misc', 'Network', 'Network_Standby'], true) === 'On'
    }.bind(this));
};

Yamaha.prototype.network.getMacFilter = function () {
    var command = this.network._createCommand('GET', 'MAC_Address_Filter');
    return this._sendXMLToReceiver(command).then(function (response) {
        var addresses = this._traverse(response, ['System', 'Misc', 'Network', 'MAC_Address_Filter', 'Address']);
        return {
            isOn: this._traverse(response, ['System', 'Misc', 'Network', 'MAC_Address_Filter', 'Mode'], true) === 'On',
            addresses: Object.keys(addresses).reduce(function (arr, addressKey) {
                arr.push(addresses[addressKey][0]['_text']);
                return arr;
            }, [])
        };
    }.bind(this));
};

//gotta catch them all


Yamaha.prototype.network.getInfo = function () {
    return Promise.all([
        this.network.getName(),
        this.network.getStandby(),
        this.network.getMacFilter()]);
};


//----------NETWORK METHODS END


//----------COMMON METHODS BEGIN

Yamaha.prototype.dimDisplay = function (level) {
    //level must be from 1 to 3
    if(level < 1) {
        level = 1;
    }
    if(level>3) {
        level = 3;
    }
    var command = this._createCommand('PUT', 'System', '<Misc><Display><FL><Dimmer>' + level + '</Dimmer></FL></Display></Misc>');
    return this._sendXMLToReceiver(command);
};

//----------COMMON METHODS END