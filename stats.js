import { graphData } from './chart.js';
import { getSummonerInfo, getMatchIDs, getMatchStats, } from './riot_api.js'
import { verifyUser, getWallet, addWallet, subWallet } from './wallet.js'
import { Client, GatewayIntentBits, EmbedBuilder, ButtonBuilder, ActionRowBuilder, AttachmentBuilder, ButtonStyle, Events, CommandInteractionOptionResolver } from 'discord.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

//isDisabled, on timeout --> the prev and next buttons will pass true so the buttons no longer work
export const makeButtons = (isDisabled, pageNum) => {

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

export async function getLOLStats(SUMMONER_NAME, TAGLINE, ACCOUNT_REGION, REGION, API_KEY){
    const summoner_info = await getSummonerInfo(ACCOUNT_REGION, SUMMONER_NAME, TAGLINE, API_KEY);

    const puuid = summoner_info["puuid"];

    const count = 51;

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
                let role = participant['teamPosition'];

                //name in API for support is UTILITY, change to support for display
                if(participant['teamPosition'] === 'UTILITY')
                    role = 'SUPPORT';

                champions.push({champ: participant['championName'], role: role});
                kills.push(participant['kills']);
                deaths.push(participant['deaths']);
                assists.push(participant['assists']);
                break;
            }
        }
    }

    let descriptions = [];
    
    //create the stat descriptions of the last 5 matches
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

    //pages for each of the stats presented:
    const embed1 = new EmbedBuilder()
                    .setTitle('Kills Per Game')
                    .setDescription(`${descriptions[0]}
                                     ${descriptions[1]}
                                     ${descriptions[2]}
                                     ${descriptions[3]}
                                     ${descriptions[4]}
                                     \nKills Over the Last 5 Matches`)
                    .setColor('Purple')
                    .setImage('attachment://kills_graph.png');

    const embed2 = new EmbedBuilder()
                    .setTitle('Deaths Per Game')
                    .setDescription(`${descriptions[0]}
                                     ${descriptions[1]}
                                     ${descriptions[2]}
                                     ${descriptions[3]}
                                     ${descriptions[4]}
                                     \nDeaths Over the Last 5 Matches`)
                    .setColor('Purple')
                    .setImage('attachment://deaths_graph.png')

    const embed3 = new EmbedBuilder()
                    .setTitle('Assists Per Game')
                    .setDescription(`${descriptions[0]}
                                     ${descriptions[1]}
                                     ${descriptions[2]}
                                     ${descriptions[3]}
                                     ${descriptions[4]}
                                     \nAssists Over the Last 5 Matches`)
                    .setColor('Purple')
                    .setImage('attachment://assists_graph.png')
    
    //Check if easter egg thumbnail is active
    let hasThumbnail = false;
    let thumbnailAttachment = null;
    
    //check for specific lookups
    if((SUMMONER_NAME === 'winter' && TAGLINE === 'liar') || 
       (SUMMONER_NAME === 'Quandale Dingle' && TAGLINE === 'CHIMP') || 
       (SUMMONER_NAME === 'Pandaras Box' && TAGLINE === 'Oreo'))
    {
        hasThumbnail = true;

        //convert the module url to a usable file path instead of being from file:///
        //because filename & dirname not in ES6 modules
        const __filename = fileURLToPath(import.meta.url);
        //removes the currentfile for the actual directory path
        const __dirname = path.dirname(__filename);

        if(SUMMONER_NAME === 'winter' && TAGLINE === 'liar'){
            //path.join builds a file path that works for every system
            const imagePath = path.join(__dirname, 'assets', 'danny_icon.JPG');
            embed1.setThumbnail(`attachment://danny_icon.JPG`);
            embed2.setThumbnail(`attachment://danny_icon.JPG`);
            embed3.setThumbnail(`attachment://danny_icon.JPG`);

            //create attachment for embed of the image
            thumbnailAttachment = new AttachmentBuilder(imagePath);

        }
        else if(SUMMONER_NAME === 'Quandale Dingle' && TAGLINE === 'CHIMP'){
            const imagePath = path.join(__dirname, 'assets', 'jordan_icon.JPG');
            embed1.setThumbnail(`attachment://jordan_icon.JPG`);
            embed2.setThumbnail(`attachment://jordan_icon.JPG`);
            embed3.setThumbnail(`attachment://jordan_icon.JPG`);

            thumbnailAttachment = new AttachmentBuilder(imagePath);
        }
        else if(SUMMONER_NAME === 'Pandaras Box' && TAGLINE === 'Oreo'){
            const imagePath = path.join(__dirname, 'assets', 'johnny_icon.JPG');
            embed1.setThumbnail(`attachment://johnny_icon.JPG`);
            embed2.setThumbnail(`attachment://johnny_icon.JPG`);
            embed3.setThumbnail(`attachment://johnny_icon.JPG`);

            thumbnailAttachment = new AttachmentBuilder(imagePath);
        }
    }

    //build each page
    //for image, despite variable attachments, every string will be attachment
    const embed = [embed1,embed2,embed3,];
    
    //buttons for previous and next
    const [prev, next] = makeButtons(false, 0);
    
    //create row for these actions
    const buttons = new ActionRowBuilder().addComponents(prev, next);
    
    //pass array of pages, buttons, and array of attachments
    //Check for easter egg
    if(hasThumbnail)
        return [embed, buttons, [k_attachment, d_attachment, a_attachment], thumbnailAttachment]

    return [embed, buttons, [k_attachment, d_attachment, a_attachment]]
}

export async function getTFTStats(SUMMONER_NAME, TAGLINE, ACCOUNT_REGION, REGION, API_KEY){

    const summoner_info = await getSummonerInfo(ACCOUNT_REGION, SUMMONER_NAME, TAGLINE, API_KEY);

    const puuid = summoner_info["puuid"];

}

export function generateDescription(kills, deaths, assists, matchDate, champion){

    return `${matchDate['month']}/${matchDate['day']} ${champion["champ"]} (${champion["role"]}): ${kills}/${deaths}/${assists}`
}