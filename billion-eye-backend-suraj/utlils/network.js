// // const os = require('os');

// // async function getLocalIpAddress() {
// //   const interfaces = os.networkInterfaces();

// //   // Look for the 'Wi-Fi' interface by name
// //   if (interfaces['Wi-Fi']) {
// //     for (const iface of interfaces['Wi-Fi']) {
// //       if (iface.family === 'IPv4' && !iface.internal) {
// //         return iface.address;  // Return the IPv4 address for Wi-Fi
// //       }
// //     }
// //   }

// //   // If no specific Wi-Fi address found, fall back to the first non-internal IPv4 address
// //   for (const name of Object.keys(interfaces)) {
// //     for (const iface of interfaces[name]) {
// //       if (iface.family === 'IPv4' && !iface.internal) {
// //         return iface.address;
// //       }
// //     }
// //   }

// //   // Fallback to '127.0.0.1' if no IPv4 address is found
// //   return '127.0.0.1';
// // }

// // module.exports = {
// //   getLocalIpAddress,
// // };
// const os = require('os');
// const dns = require('dns').promises;
// const fs = require('fs');

// function isRunningInDocker() {
//   try {
//     return fs.existsSync('/.dockerenv') ||
//       fs.readFileSync('/proc/1/cgroup', 'utf8').includes('docker');
//   } catch {
//     return false;
//   }
// }

// async function resolveHostDockerInternal() {
//   try {
//     const addresses = await dns.lookup('host.docker.internal');
//     return addresses.address;
//   } catch (err) {
//     console.warn('[WARN] Failed to resolve host.docker.internal:', err.message);
//     return null;
//   }
// }

// function getHostWiFiIp() {
//   const interfaces = os.networkInterfaces();

//   for (const ifaceName of ['Wi-Fi', 'wlan0', 'wlp2s0', 'en0']) {
//     const iface = interfaces[ifaceName];
//     if (iface) {
//       for (const addr of iface) {
//         if (addr.family === 'IPv4' && !addr.internal) {
//           return addr.address;
//         }
//       }
//     }
//   }

//   for (const name of Object.keys(interfaces)) {
//     for (const iface of interfaces[name]) {
//       if (iface.family === 'IPv4' && !iface.internal) {
//         return iface.address;
//       }
//     }
//   }

//   return '127.0.0.1';
// }

// async function getLocalIpAddress() {
//   if (isRunningInDocker()) {
//     const resolvedIp = await resolveHostDockerInternal();
//     if (resolvedIp && resolvedIp !== '127.0.0.1') {
//       return resolvedIp;
//     }
//   }

//   return getHostWiFiIp();
// }

// module.exports = {
//   getLocalIpAddress,
// };
