# PetLibro API (Node.js)

A reverse-engineered client for PetLibro smart feeders and water fountains.

## Installation
```bash
npm install petlibro-api
```

## Usage
```javascript
const PetLibroAPI = require('petlibro-api');

const api = new PetLibroAPI('email@example.com', 'password');

(async () => {
  await api.login();
  
  const devices = await api.getDevices();
  const feeder = devices[0].deviceSn;

  // Feed 1 portion (approx 1/12 cup)
  await api.manualFeed(feeder, 1);
})();
```

## Features
[x] Login & Token Refresh

[x] Device Listing

[x] Manual Feeding

[x] Vacuum Control (Granary)

[x] Water Fountain Control (Dockstream)

## Tree
```
petlibro-api/
├── index.js          <-- Logic + Constants
├── index.mjs         <-- Import bridge
├── index.d.ts        <-- Autocomplete magic
├── package.json      <-- Config
├── README.md         <-- Instructions
└── .gitignore        <-- Safety
```
