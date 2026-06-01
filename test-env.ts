import * as dotenv from 'dotenv';
dotenv.config();

console.log('EVOLUTION_API_URL:', process.env.EVOLUTION_API_URL ? 'DEFINED (' + process.env.EVOLUTION_API_URL + ')' : 'UNDEFINED');
console.log('EVOLUTION_API_KEY length:', process.env.EVOLUTION_API_KEY ? process.env.EVOLUTION_API_KEY.length : 0);
console.log('GEMINI_API_KEY length:', process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.length : 0);
process.exit(0);
