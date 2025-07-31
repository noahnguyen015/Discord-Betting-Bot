import {getSummonerInfo, getMatchIDs, getMatchStats} from './riot_api.js'
import { Client, GatewayIntentBits } from 'discord.js';


//load the dotenv library so it reads the .env
//set up the values in process.env
require('dotenv').config();

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });

//access the .env file for the token
const DISCORD_TOKEN = process.env.DISCORD_TOKEN; // Replace with your bot token

client.once('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);
});

client.on('messageCreate', message => {
    if (message.author.bot) return;

    if (message.content === '!ping') {
        message.channel.send('Pong!');
    }
});

client.login(DISCORD_TOKEN);

const API_KEY = process.env.API_KEY;
const ACCOUNT_REGION = 'americas' //accounts are global, just use any endpoints americas/europe/asia
const REGION = 'americas' //for game data like matches and stats once you get PUUID which is regions-specific
const SUMMONER_NAME = 'kraneh'
const TAGLINE = 'NA1'


async function getStats(){

    try{

        const summoner_info = await getSummonerInfo(ACCOUNT_REGION, SUMMONER_NAME, TAGLINE, API_KEY);

        const puuid = summoner_info["puuid"];
        const count = 5;

        const match_ids = await getMatchIDs(REGION, API_KEY, puuid, count);


        for(let i = 0; i < match_ids.length; i++){
            const match_stats = await getMatchStats(REGION, API_KEY, match_ids[i]);

            const participants = match_stats['info']['participants'];
            const game_type = match_stats['info']['queueId']

            for(let j = 0; j < participants.length; j++)
                if(participants[j]['riotIdGameName'] === SUMMONER_NAME && participants[j]['riotIdTagline'] === TAGLINE) {
                    console.log(`===============MATCH ${match_ids[i]} SUMMARY===============`)
                    console.log(`GAME TYPE: ${game_type}`);
                    console.log(`GAME DURATION: ${match_stats['info']['gameDuration']} WIN?: (${participants[j]['win']})`);
                    console.log(`SUMMONER: ${participants[j]['riotIdGameName']}#${participants[j]['riotIdTagline']}`); 
                    console.log(`KDA: ${participants[j]['kills']}/${participants[j]['deaths']}/${participants[j]['assists']}`);
                    console.log(`Damage Dealt: ${participants[j]['totalDamageDealtToChampions']}`);
                    break;
                }
        }
    
    }catch(err){
        console.log(err.message);
    }   
}

getStats();