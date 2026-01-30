// index.d.ts
export = PetLibroAPI;

declare class PetLibroAPI {
  constructor(email: string, pass: string, region?: string, timezone?: string);

  login(): Promise<string>;
  
  // Read Methods
  getDevices(): Promise<any[]>;
  getDeviceState(sn: string): Promise<any>;
  getDeviceData(sn: string): Promise<any>;
  getDeviceEvents(sn: string): Promise<any>;
  getWaterStats(sn: string): Promise<any>;

  // Control Methods
  manualFeed(sn: string, portions?: number): Promise<any>;
  setVacuumMode(sn: string, mode: PetLibroAPI.VacuumMode): Promise<any>;
  setLight(sn: string, enable: boolean): Promise<any>;
  setSound(sn: string, enable: boolean): Promise<any>;

  // Water Control
  setWaterModeConstant(sn: string): Promise<any>;
  setWaterModeIntermittent(sn: string, interval: number, duration?: number): Promise<any>;
  setWaterModeRadarNear(sn: string, interval: number, duration?: number): Promise<any>;
  setWaterModeOff(sn: string): Promise<any>;
}

declare namespace PetLibroAPI {
  export enum VacuumMode {
    AUTO = "0",
    MANUAL = "1",
    OFF = "2"
  }
}
