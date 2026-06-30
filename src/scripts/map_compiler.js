const fs = require('fs');
const path = require('path');

const mapDir = 'C:\\Users\\krist\\Downloads\\map';
const outputDir = path.join(process.cwd(), 'src', '3D', 'map');

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

const compiledLocations = [];

fs.readdirSync(mapDir).forEach(file => {
  if (file.startsWith('maplocations') && file.endsWith('.json')) {
    const filePath = path.join(mapDir, file);
    try {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      if (data && data.files) {
        data.files.forEach(f => {
          if (f && f.locations) {
            f.locations.forEach(loc => {
              const match = file.match(/maplocations-5_(\d+)\.batch\.json/);
              if (match) {
                const regionId = parseInt(match[1], 10);
                const regionX = regionId & 0x7F; 
                const regionZ = regionId >> 7; 

                loc.uses.forEach(use => {
                  compiledLocations.push({
                    id: loc.id,
                    worldX: (regionX * 64) + use.x,
                    worldZ: (regionZ * 64) + use.y, 
                    plane: use.plane,
                    rotation: use.rotation,
                    type: use.type
                  });
                });
              }
            });
          }
        });
      }
    } catch (err) {
      console.error('Failed to parse ' + file + ':', err.message);
    }
  }
});

fs.writeFileSync(path.join(outputDir, 'compiled_locations.json'), JSON.stringify(compiledLocations));
console.log('Compiled ' + compiledLocations.length + ' locations into compiled_locations.json');
