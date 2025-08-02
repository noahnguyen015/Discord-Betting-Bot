import {getSummonerInfo, getMatchIDs, getMatchStats} from './riot_api.js'
import { Client, GatewayIntentBits } from 'discord.js';
import dotenv from 'dotenv';

//load the dotenv library so it reads the .env
//set up the values in process.env
dotenv.config(); 

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });

//access the .env file for the token
const DISCORD_TOKEN = process.env.DISCORD_TOKEN; // Replace with your bot token

let SUMMONER_NAME = '';
let TAGLINE = '';

//runs once the bot is ready from successful login to Discord, shows print on console
client.once('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);
});

/*
    1. listen for event of discord messages
    2. event = messageCreate, so a new smessage
    3. arrow function everytime message is made
    4. syntax: 
    content = text content, 
    author = user who sent it, 
    channel = channel it was sent in,
    guild = server it is in 
*/
client.on('messageCreate', (message) => {
    //whether the message comes from bot
    if (message.author.bot) 
        return;

    //regex to include characters in between quotes or without quotes or spaces
    const args = message.content.match(/(?:[^\s"]+|"[^"]*")+/g);

    if(args.length <= 1){
        message.channel.send('💥 Please enter the summoner name with the command $ss "SummonerName#TAG"');
        return
    }

    const cmd = args.shift().toLowerCase();

    if (!args[0].startsWith('"') || !args[0].endsWith('"')){
        message.channel.send('💥 Uh-Oh! make sure to quote your summoner name! $ss "SummonerName#TAG"');
        return
    }

    const summoner = args[0].replace(/"/g, '');

    let count = 0;

    for(let i = 0; i < summoner.length; i++){
        if(summoner[i] == '#')
            count++;
    }

    if(count != 1){
        message.channel.send('💥 Tag Error, please check your tag! $ss "SummonerName#TAG"');
        return
    }

    const tagidx = summoner.indexOf('#');
    SUMMONER_NAME = summoner.slice(0, tagidx).trim();
    TAGLINE = summoner.slice(tagidx+1).trim();

    if (cmd === '$ss') {
        message.channel.send(`The current summoner is: ${SUMMONER_NAME} \nThe tag is ${TAGLINE}`);
        getStats();
    }else{
        message.channel.send('💥 Please check the name of the command!');
    }
});

client.login(DISCORD_TOKEN);

const API_KEY = process.env.API_KEY;
const ACCOUNT_REGION = 'americas' //accounts are global, just use any endpoints americas/europe/asia
const REGION = 'americas' //for game data like matches and stats once you get PUUID which is regions-specific


async function getStats(){

    try{

        const summoner_info = await getSummonerInfo(ACCOUNT_REGION, SUMMONER_NAME, TAGLINE, API_KEY);

        const puuid = summoner_info["puuid"];

        const count = 5;

        const match_ids = await getMatchIDs(REGION, API_KEY, puuid, count);

        for(let i = 0; i < match_ids.length; i++){
            const match_stats = await getMatchStats(REGION, API_KEY, match_ids[i]);

            const participants = match_stats['info']['participants'];
            const game_type = match_stats['info']['queueId'];

            for(let j = 0; j < participants.length; j++){
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
        }
    
    }catch(err){
        console.log(err.message);
    }   
}