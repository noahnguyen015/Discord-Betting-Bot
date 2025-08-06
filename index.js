import {graphData } from './chart.js';
import {getSummonerInfo, getMatchIDs, getMatchStats} from './riot_api.js'
import { Client, GatewayIntentBits, EmbedBuilder, ButtonBuilder, ActionRowBuilder, AttachmentBuilder, ButtonStyle, Events, CommandInteractionOptionResolver } from 'discord.js';
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
const makeButtons = (isDisabled, pageNum) => {

    let disablePrev = true;
    let disableNext = true;

    if(!isDisabled){
        if(pageNum == 0){
            disablePrev = true;
            disableNext = false;
        }
        else if(pageNum < 2){
            disablePrev = false;
            disableNext = false;
        }
        else if(pageNum == 2){
            disablePrev = false;
            disableNext = true;
        }
        else {
            console.error('Incorrect Page Index Error; Unable to create buttons')
        }
    }

    const button1 = new ButtonBuilder()
        .setCustomId('PrevId')
        .setLabel('Prev')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(disablePrev);

    const button2 = new ButtonBuilder()
        .setCustomId('NextId')
        .setLabel('Next')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(disableNext);

    return [button1, button2]
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
        try{
            message.channel.send(`The current summoner is: ${SUMMONER_NAME} \nThe tag is ${TAGLINE}`);

            //get the buttons and embed pages
            const pages = await getStats();

            if(!pages){
                message.channel.send('❌ Insufficient Number of Matches Found. Has this user played enough games?"');
                throw new Error('Error has occured; Insufficient or Unretrievable data');
            }

            let currentPage = 0;

            //build the embedded message
            //send the pages over starting with first page, and the buttons, then the attachment variables
            const embed = await message.channel.send({embeds: [pages[0][0]], 
                                                    components: [pages[1]],
                                                    files: [pages[2][0]],
                                                    });

            //look for interaction, keep u for 4 minutes 240__000 means 240 seconds
            const collector = embed.createMessageComponentCollector({time: 240_000});

            //collect interaction
            collector.on('collect', async (interaction) => {

                //check if the pressed button was the next or previous button
                if(interaction.customId === 'PrevId' && currentPage > 0){
                    currentPage--;
                }
                else if(interaction.customId === 'NextId' && currentPage < pages[0].length-1){
                    currentPage++;
                }

                //build new clones of buttons where false = not expired, currentPage for correct buttons
                const [prev, next] = makeButtons(false,currentPage);

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
                const [prev, next] = makeButtons(true,currentPage);
                const buttons = new ActionRowBuilder().addComponents(prev, next);

                await embed.edit({embeds: [pages[0][currentPage]], 
                                components: [buttons], 
                                files: [pages[2][currentPage]],});
            });
        }catch(error){
            console.error(`Error Caught: ${error.message}`);
        }
    }
    else{
        message.channel.send('❗ Please check the name of the command!');
    }
});

client.login(DISCORD_TOKEN);

const API_KEY = process.env.API_KEY;
const ACCOUNT_REGION = 'americas' //accounts are global, just use any endpoints americas/europe/asia
const REGION = 'americas' //for game data like matches and stats once you get PUUID which is regions-specific


async function getStats(){
    const summoner_info = await getSummonerInfo(ACCOUNT_REGION, SUMMONER_NAME, TAGLINE, API_KEY);

    const puuid = summoner_info["puuid"];

    const count = 56;

    const match_ids = await getMatchIDs(REGION, API_KEY, puuid, count);

    let match_participants = [];

    //list for the stats and dates
    let kills = [];
    let assists = [];
    let deaths = [];
    let champions = [];
    let matchDates = [];

    //Collect all of the games from the last 
    for(let i = 0; i < match_ids.length; i++){
        try {
            const match_stats = await getMatchStats(REGION, API_KEY, match_ids[i]);

            const participants = match_stats['info']['participants'];
            const game_type = match_stats['info']['queueId'];
            const matchDuration = match_stats['info']['gameDuration']; 

            //if the game is normal-draft, ranked solo/duo, ranked flex, and not a remake
            if((game_type === 400 || game_type === 420 || game_type === 440) && matchDuration > 600){
                if(match_participants.length === 5)
                    break;
                else {
                    //retrieve the actual date of the match
                    //use the UNIX timestamp in milliseconds
                    const matchDate = new Date(match_stats['info']['gameStartTimestamp']);
                    const matchDay = matchDate.getDate(); //get the day of match for the graph
                    const matchMonth = matchDate.getMonth() + 1; //0 indexed for the month of match
                    matchDates.push({month: matchMonth, day: matchDay,});
                    match_participants.push(participants);
                }
            }

        }catch(error) {
            console.error(error.message);
        }
    }

    //If 5 matches aren't found, return insufficient data
    if(match_participants.length !== 5){
        return null;
    }

    //go through all normal draft, ranked solo/duo, ranked flex
    for(let i = 0; i < match_participants.length; i++){

        const participants = match_participants[i];
        //check each match for stats
        for(let j = 0; j < participants.length; j++){
            //find the person that was looked up for the data
            if(participants[j]['riotIdGameName'] === SUMMONER_NAME && participants[j]['riotIdTagline'] === TAGLINE) {
                const participant = participants[j];
                champions.push(participant['championName']);
                kills.push(participant['kills']);
                deaths.push(participant['deaths']);
                assists.push(participant['assists']);
                break;
            }
        }
    }

    let descriptions = [];

    for(let i = 0; i < match_participants.length; i++){
        descriptions.push(generateDescription(kills[i], deaths[i], assists[i], matchDates[i], champions[i]));
    }


    //map of buffers
    let buffers = {};

    //returns buffers of the graphs, add them to a map
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
                    .setDescription(`${descriptions[0]}
                                     ${descriptions[1]}
                                     ${descriptions[2]}
                                     ${descriptions[3]}
                                     ${descriptions[4]}
                                     \nKills Over the Last 5 Matches`)
                    .setColor('Purple')
                    .setImage('attachment://kills_graph.png'),
                    new EmbedBuilder()
                    .setTitle('Deaths Per Game')
                    .setDescription(`${descriptions[0]}
                                     ${descriptions[1]}
                                     ${descriptions[2]}
                                     ${descriptions[3]}
                                     ${descriptions[4]}
                                     \nDeaths Over the Last 5 Matches`)
                    .setColor('Purple')
                    .setImage('attachment://deaths_graph.png'),
                    new EmbedBuilder()
                    .setTitle('Assists Per Game')
                    .setDescription(`${descriptions[0]}
                                     ${descriptions[1]}
                                     ${descriptions[2]}
                                     ${descriptions[3]}
                                     ${descriptions[4]}
                                     \nAssists Over the Last 5 Matches`)
                    .setColor('Purple')
                    .setImage('attachment://assists_graph.png'),
                    ]
    
    //buttons for previous and next
    const [prev, next] = makeButtons(false, 0);
    
    //create row for these actions
    const buttons = new ActionRowBuilder().addComponents(prev, next);
    
    //pass array of pages, buttons, and array of attachments
    return [embed, buttons, [k_attachment, d_attachment, a_attachment]]
}

function generateDescription(kills, deaths, assists, matchDates, championName){

    return `${matchDates['month']}/${matchDates['day']} ${championName}: ${kills}/${deaths}/${assists}`

}