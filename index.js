import {getSummonerInfo, getMatchIDs, getMatchStats} from './riot_api.js'
import { Client, GatewayIntentBits, EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, Events } from 'discord.js';
import dotenv from 'dotenv';

//load the dotenv library so it reads the .env
//set up the values in process.env
dotenv.config(); 

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });

//access the .env file for the token
const DISCORD_TOKEN = process.env.DISCORD_TOKEN; // Replace with your bot token

let SUMMONER_NAME = '';
let TAGLINE = '';

const makeButtons = (isDisabled) => {
    const button1 = new ButtonBuilder()
        .setCustomId('NextId')
        .setLabel('Next')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(isDisabled);
    
    const button2 = new ButtonBuilder()
        .setCustomId('PrevId')
        .setLabel('Prev')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(isDisabled);

    return [button2, button1]
}

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
client.on('messageCreate', async (message) => {
    //whether the message comes from bot
    if (message.author.bot) 
        return;

    //regex to include characters in between quotes or without quotes or spaces
    const args = message.content.match(/(?:[^\s"]+|"[^"]*")+/g);

    //more than 1 argument check
    if(args.length <= 1){
        message.channel.send('💥 Please enter the summoner name with the command $ss "SummonerName#TAG"');
        return
    }

    //grab the first command to check if correct
    const cmd = args.shift().toLowerCase();

    //first index after cmd is 1st argument, check for quotes
    if (!args[0].startsWith('"') || !args[0].endsWith('"')){
        message.channel.send('💥 Uh-Oh! make sure to quote your summoner name! $ss "SummonerName#TAG"');
        return
    }

    //remove all quotes from the argument
    const summoner = args[0].replace(/"/g, '');

    let count = 0; 

    //check for more than 1 # for the tag
    for(let i = 0; i < summoner.length; i++){
        if(summoner[i] == '#')
            count++;
    }

    //if more than 1 tag or no tag, raise error
    if(count != 1){
        message.channel.send('💥 Tag Error, please check your tag! $ss "SummonerName#TAG"');
        return
    }

    //split up name and the tagline for the summoner/riot account
    const tagidx = summoner.indexOf('#');
    SUMMONER_NAME = summoner.slice(0, tagidx).trim();
    TAGLINE = summoner.slice(tagidx+1).trim();

    //for information (ss = summoner stats)
    if (cmd === '$ss') {

        message.channel.send(`The current summoner is: ${SUMMONER_NAME} \nThe tag is ${TAGLINE}`);

        //get the buttons and embed pages
        const pages = await getStats();
        let currentPage = 0;

        //send the pages over starting with first page, and the buttons
        const embed = await message.channel.send({embeds: [pages[0][0]], components: [pages[1]]});

        //look for interaction, keep u for 3 minutes
        const collector = embed.createMessageComponentCollector({time: 180_000});

        //collect interaction
        collector.on('collect', async (interaction) => {

            //check if next or previous button
            if(interaction.customId === 'PrevId' && currentPage > 0){
                currentPage--;
            }
            else if(interaction.customId === 'NextId' && currentPage < pages[0].length-1){
                currentPage++;

            }

            //build new clones of buttons
            const [prev, next] = makeButtons(false);

            //throw into action row
            const buttons = new ActionRowBuilder().addComponents(prev, next);

            //update the embed page with the previous or next page
            await interaction.update({embeds: [pages[0][currentPage]], components: [buttons] });
        });

        //handles the timeout
        collector.on('end', async () => {
            await embed.edit({embeds: [pages[0][currentPage]], components: [makeButtons(true)],});
        });

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

                    /*
                    console.log(`===============MATCH ${match_ids[i]} SUMMARY===============`)
                    console.log(`GAME TYPE: ${game_type}`);
                    console.log(`GAME DURATION: ${match_stats['info']['gameDuration']} WIN?: (${participants[j]['win']})`);
                    console.log(`SUMMONER: ${participants[j]['riotIdGameName']}#${participants[j]['riotIdTagline']}`); 
                    console.log(`KDA: ${participants[j]['kills']}/${participants[j]['deaths']}/${participants[j]['assists']}`);
                    console.log(`Damage Dealt: ${participants[j]['totalDamageDealtToChampions']}`);
                    */

                    break;
                }
            }
        }

        const embed = [new EmbedBuilder().setTitle('Page 1').setDescription('This is the first page').setColor('Purple'),
                       new EmbedBuilder().setTitle('Page 2').setDescription('This is the second page').setColor('Purple'),
                       new EmbedBuilder().setTitle('Page 3').setDescription('This is the third page').setColor('Purple'),
                      ]

        const [prev, next] = makeButtons(false);

        const buttons = new ActionRowBuilder().addComponents(prev, next);

        return [embed, buttons]
    
    }catch(err){
        console.log(err.message);
    }   
}