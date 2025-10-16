// hash.js - Hash-Generator für Passwort
// Usage: node hash.js dein_passwort
const bcrypt = require('bcrypt');

const password = process.argv[2];
if (!password) {
  console.log('Bitte gib ein Passwort als Argument an!');
  process.exit(1);
}

bcrypt.hash(password, 12).then(hash => {
  console.log('Bcrypt-Hash für', password + ':');
  console.log(hash);
});
