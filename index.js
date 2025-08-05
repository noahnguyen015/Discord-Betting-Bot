import { graphData } from './chart.js';
import {getSummonerInfo, getMatchIDs, getMatchStats} from './riot_api.js'
import { Client, GatewayIntentBits, EmbedBuilder, ButtonBuilder, ActionRowBuilder, AttachmentBuilder, ButtonStyle, Events } from 'discord.js';
import dotenv from 'dotenv';

//load the dotenv library so it reads the .env
//set up the values in process.env
dotenv.config(); 

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });

//access the .env file for the token
const DISCORD_TOKEN = process.env.DISCORD_TOKEN; // Replace with your bot token

let SUMMONER_NAME = '';
let TAGLINE = '';

//isDisabled, on timeout --> the prev and next buttons will pass true so the buttons no longer work
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
        message.channel.send('❗ Please enter the summoner name with the command $ss "SummonerName#TAG"');
        return
    }

    //grab the first command to check if correct
    const cmd = args.shift().toLowerCase();

    //first index after cmd is 1st argument, check for quotes
    if (!args[0].startsWith('"') || !args[0].endsWith('"')){
        message.channel.send('❗ Uh-Oh! make sure to quote your summoner name! $ss "SummonerName#TAG"');
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
        message.channel.send('❗ Tag Error, please check your tag! $ss "SummonerName#TAG"');
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

        //build the embedded message
        //send the pages over starting with first page, and the buttons, then the attachment variables
        const embed = await message.channel.send({embeds: [pages[0][0]], 
                                                  components: [pages[1]],
                                                  files: [pages[2][0]],
                                                });

        //look for interaction, keep u for 3 minutes
        const collector = embed.createMessageComponentCollector({time: 60_000});

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
            await interaction.update({embeds: [pages[0][currentPage]], 
                                      components: [buttons], 
                                      files: [pages[2][currentPage]],});
        });

        //handles the timeout
        collector.on('end', async () => {
            //build new clones of buttons
            const [prev, next] = makeButtons(true);
            const buttons = new ActionRowBuilder().addComponents(prev, next);

            await embed.edit({embeds: [pages[0][currentPage]], 
                              components: [buttons], 
                              files: [pages[2][currentPage]],});
        });

    }else{
        message.channel.send('❗ Please check the name of the command!');
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

        let kills = [];
        let assists = [];
        let deaths = [];
        let matchDates = [];

        for(let i = 0; i < match_ids.length; i++){
            const match_stats = await getMatchStats(REGION, API_KEY, match_ids[i]);

            const participants = match_stats['info']['participants'];
            const game_type = match_stats['info']['queueId'];

            const matchDate = new Date(match_stats['info']['gameStartTimestamp']);

            const matchDay = matchDate.getDate(); //
            const matchMonth = matchDate.getMonth() + 1; //0 indexed

            matchDates.push({month: matchMonth, day: matchDay,});

            //check each match
            for(let j = 0; j < participants.length; j++){
                //find the person that was looked up for the data
                if(participants[j]['riotIdGameName'] === SUMMONER_NAME && participants[j]['riotIdTagline'] === TAGLINE) {
                    
                    const participant = participants[j];

                    kills.push(participant['kills']);
                    deaths.push(participant['deaths']);
                    assists.push(participant['assists']);

                    break;
                }
            }
        }

        //map of buffers
        let buffers = {};

        //returns buffers, add them to the map
        buffers['killBuffer'] = await graphData(kills, matchDates, 'Kills');
        buffers['deathBuffer'] = await graphData(deaths, matchDates, 'Deaths');
        buffers['assistBuffer'] = await graphData(assists, matchDates, 'Assists');

        //create a file attachment (image attachment PNG) 
        //use buffer to assign to file for the discord embed message and assign name to the file/image for the attachment
        const k_attachment = new AttachmentBuilder(buffers['killBuffer'], {name: 'kills_graph.png'});
        const d_attachment = new AttachmentBuilder(buffers['deathBuffer'], {name: 'deaths_graph.png'});
        const a_attachment = new AttachmentBuilder(buffers['assistBuffer'], {name: 'assists_graph.png'});

        //build each page
        //for image, despite variable attachments, every string will be attachment
        const embed = [new EmbedBuilder()
                       .setTitle('Kills Per Game')
                       .setDescription('Kills over the last 5 matches')
                       .setColor('Purple')
                       .setImage('attachment://kills_graph.png'),
                       new EmbedBuilder()
                       .setTitle('Deaths Per Game')
                       .setDescription('Deaths over the last 5 matches')
                       .setColor('Purple')
                       .setImage('attachment://deaths_graph.png'),
                       new EmbedBuilder()
                       .setTitle('Assists Per Game')
                       .setDescription('Assists over the last 5 matches')
                       .setColor('Purple')
                       .setImage('attachment://assists_graph.png'),
                      ]
        
        //buttons for previous and next
        const [prev, next] = makeButtons(false);
        
        //create row for these actions
        const buttons = new ActionRowBuilder().addComponents(prev, next);
        
        //pass array of pages, buttons, and array of attachments
        return [embed, buttons, [k_attachment, d_attachment, a_attachment]]
    
    }catch(err){
        console.log(err.message);
    }   
}