/* Credit to: 
  - Sascha Corti 
  - bobdahacker.com
  - jjjonesjr33/petlibro
  - Google Gemini

  JAKENOLOGY/NODE-PETLIBRO
  A NODE.JS PETLIBRO API CLIENT
  FOR GENERAL APPLICATION USE
*/
const axios = require('axios');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

const TRANSLATIONS = {
    '宠物智能设备': 'Smart pet devices',
    '喂食器': 'feeder'
}

class PetLibroAPI {
    constructor(email, password, region = 'US', timezone = 'America/Chicago') {
        this.email = email;
        this.password = password;
        this.region = region;
        this.timezone = timezone;
        
        // Config constants
        this.APP_ID = 1;
        this.APP_SN = "c35772530d1041699c87fe62348507a8";
        this.BASE_URL = region === 'US' ? 'https://api.us.petlibro.com' : 'https://api.us.petlibro.com';

        this.token = null;

        // Axios instance with default headers
        this.client = axios.create({
            baseURL: this.BASE_URL,
            headers: {
                'source': 'ANDROID',
                'language': 'EN',
                'timezone': this.timezone,
                'version': '1.3.45',
                'Content-Type': 'application/json',
                'accept-encoding': 'gzip'
            }
        });

        // Request interceptor to attach token
        this.client.interceptors.request.use(config => {
            if (this.token) {
                config.headers['token'] = this.token;
            }
            return config;
        });

        // Response interceptor for token expiration (Code 1009)
        this.client.interceptors.response.use(
            response => response,
            async error => {
                const originalRequest = error.config;
                if (error.response?.data?.code === 1009 && !originalRequest._retry) {
                    originalRequest._retry = true;
                    await this.login();
                    originalRequest.headers['token'] = this.token;
                    return this.client(originalRequest);
                }
                return Promise.reject(error);
            }
        );
    }

    /**
     * Internal Helper: Normalizes Chinese fields to English
     */
    _normalize(device) {
        if (!device || typeof device !== 'object') return device;

        // 1. Shallow copy to protect original data
        const normalized = { ...device };

        // 2. Scan every key
        Object.keys(normalized).forEach(key => {
            const val = normalized[key];
            
            // Check if value is in our dictionary
            if (typeof val === 'string' && TRANSLATIONS[val]) {
                normalized[key] = TRANSLATIONS[val];
            }
        });

        return normalized;
    }

    hashPassword(password) {
        return crypto.createHash('md5').update(password).digest('hex');
    }

    async login() {
        const payload = {
            appId: this.APP_ID,
            appSn: this.APP_SN,
            country: this.region,
            email: this.email,
            password: this.hashPassword(this.password),
            phoneBrand: "",
            phoneSystemVersion: "",
            timezone: this.timezone
        };

        const { data } = await this.client.post('/member/auth/login', payload);
        
        if (data.code === 0 && data.data?.token) {
            this.token = data.data.token;
            return this.token;
        }
        throw new Error(`Login failed: ${data.msg}`);
    }

    /**
     * Standard wrapper for POST requests that require Device SN
     * Matches Python's `post_serial`
     */
    async postSerial(path, sn, extraPayload = {}) {
        const payload = {
            id: sn,
            deviceSn: sn,
            ...extraPayload
        };
        const { data } = await this.client.post(path, payload);
        
        // Handle "Raw Integer" responses (common in control commands)
        if (typeof data === 'number') return data;
        
        // Handle standard JSON responses
        if (data.code !== 0) throw new Error(`API Error [${path}]: ${data.msg}`);
        return data.data;
    }

    /**
     * Wrapper for Control Commands (Manual feed, vacuum, etc)
     * Injects a UUID `requestId` which is required for these to work
     */
    async postCommand(path, sn, extraPayload = {}) {
        const requestId = uuidv4().replace(/-/g, '');
        return this.postSerial(path, sn, { 
            requestId, 
            ...extraPayload 
        });
    }

    // ==========================================
    //              READ METHODS
    // ==========================================

    async getDevices() {
        const { data } = await this.client.post('/device/device/list', {});
        // Scan array and normalize all objects
        if (Array.isArray(data.data)) {
            return data.data.map(device => this._normalize(device));
        }
        return [];
    }

    async getDeviceState(sn) {
        return this.postSerial('/device/device/realInfo', sn);
    }

    async getDeviceData(sn) {
        return this.postSerial('/data/data/realInfo', sn); // Historical/Graph data
    }

    async getDeviceEvents(sn) {
        return this.postSerial('/data/event/deviceEventsV2', sn); // Logs/Errors
    }

    async getWaterStats(sn) {
        return this.postSerial('/data/deviceDrinkWater/todayDrinkData', sn);
    }

    // ==========================================
    //             CONTROL METHODS
    // ==========================================

    /**
     * Manual Feed
     * @param {string} sn 
     * @param {number} portions - Number of portions (1/12 cup usually)
     */
    async manualFeed(sn, portions = 1) {
        return this.postCommand('/device/device/manualFeeding', sn, { 
            grainNum: parseInt(portions) 
        });
    }

    /**
     * Set Vacuum Mode (for Granary/Vacuum feeders)
     * @param {string} sn 
     * @param {string} mode - "0" (Auto), "1" (Manual), "2" (Off) - verification needed on exact enum
     */
    async setVacuumMode(sn, mode) {
        return this.postCommand('/device/device/vacuum', sn, { 
            vacuumMode: mode 
        });
    }
  
    static get VacuumMode() {
        return {
            AUTO: "0",
            MANUAL: "1",
            OFF: "2"
        };
    }

    static get WaterMode() {
        return {
            CONSTANT: 0,
            INTERMITTENT: 1,
            RADAR: 2
        };
    }
    async setLight(sn, enable) {
        return this.client.post('/device/setting/updateLightSwitch', {
            deviceSn: sn,
            enable: !!enable
        });
    }

    async setSound(sn, enable) {
        return this.client.post('/device/setting/updateSoundSwitch', {
            deviceSn: sn,
            enable: !!enable
        });
    }

    // ==========================================
    //      COMPLEX WATER FOUNTAIN LOGIC
    // ==========================================

    async setWaterModeOn(sn) {
        // Stop switch FALSE means ON
        return this.postSerial('/device/device/waterModeSetting', sn, { 
            waterStopSwitch: false 
        });
    }

    async setWaterModeOff(sn) {
        // Stop switch TRUE means OFF
        return this.postSerial('/device/device/waterModeSetting', sn, { 
            waterStopSwitch: true 
        });
    }

    /**
     * Constant Flow Mode
     * useWaterType: 0
     */
    async setWaterModeConstant(sn) {
        await this.setWaterModeOn(sn); // Ensure device is ON first
        return this.postCommand('/device/device/waterModeSetting', sn, {
            useWaterType: 0,
            useWaterInterval: 0,
            useWaterDuration: 0
        });
    }

    /**
     * Intermittent Mode (e.g. 5 mins on, 10 mins off)
     * useWaterType: 1
     */
    async setWaterModeIntermittent(sn, interval, duration) {
        await this.setWaterModeOn(sn);
        return this.postCommand('/device/device/waterModeSetting', sn, {
            useWaterType: 1,
            useWaterInterval: interval,
            useWaterDuration: duration
        });
    }

    /**
     * Radar/Sensor Mode (Near)
     * Requires TWO calls: Update Radar settings -> Update Water settings
     * useWaterType: 2
     */
    async setWaterModeRadarNear(sn, interval, duration) {
        await this.setWaterModeOn(sn);

        // Step 1: Set Radar Sensitivity
        await this.client.post('/device/setting/updateRadarSetting', {
            deviceSn: sn,
            radarSensingLevel: "NearTrigger"
        });

        // Step 2: Set Water Mode to Sensed (Type 2)
        return this.postCommand('/device/device/waterModeSetting', sn, {
            useWaterType: 2,
            useWaterInterval: interval,
            useWaterDuration: duration
        });
    }
}

module.exports = PetLibroAPI;