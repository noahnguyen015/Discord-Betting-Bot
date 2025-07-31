import {getSummonerInfo, getMatchIDs, getMatchStats} from './riot_api.js'
import { Client, GatewayIntentBits } from 'discord.js';
import dotenv from 'dotenv';

//load the dotenv library so it reads the .env
//set up the values in process.env
dotenv.config(); 

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });

//access the .env file for the token
const DISCORD_TOKEN = process.env.DISCORD_TOKEN; // Replace with your bot token

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

    /*
        1. trim(), removes the whitespace from start & end
        2. split(), turns string into array with separator
        3. regex -> /(?:[^\s"]+|"[^"]*")+/g where:
            /.../ = regex

            ?:... = group regex parts together (structure not for returns)
                - doesn't save what it matched, or keeps what it saw so we don't need to repeat

            [^\s"]+ = character set [], ^ (not), whitespace, quote(")

            OR ( | )

            "[^"]*" 
                " = matches a single quote
                [^"]* = matche zero or more non-quote chars
                " = ends with quote

            matches with ()+ which means one or more of those two groups w/ g (global match)
            \g = find all matches not the just the first one for match() 


    */

    //results in array of all the matches to this regex, command, args
    const args = message.content.match(/(?:[^\s"]+|"[^"]*")+/g);

    /*
        1. shift() removes first item from array & returns
            - so cmd will always be the command not the arguments
        2. toLowerCase to make the name of the command lowercase
            - so it doesn't matter how you type the command (less sensitive)
    */
    const cmd = args.shift().toLowerCase();

    /*
    replace all instances of quotes
        /.../ = regex
        " = quote
        g at end = all instances
        */
    const summoner = args[0].replace(/"/g, '');

    if (cmd === '!ss') {

        if(!summoner)
            message.channel.send('💥 Uh-Oh! Please check your arguments! !ss "SummonerName#TAG"')

        message.channel.send(`The current summoner is: ${summoner}`);
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