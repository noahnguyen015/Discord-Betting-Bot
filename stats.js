import { graphLOLData, graphTFTData } from './chart.js';
import { getSummonerInfo, getLOLMatchIDs, getLOLMatchStats, getTFTMatchIDs, getTFTMatchStats} from './riot_api.js'
import { verifyUser, getWallet, addWallet, subWallet } from './wallet.js'
import { Client, GatewayIntentBits, EmbedBuilder, ButtonBuilder, ActionRowBuilder, AttachmentBuilder, ButtonStyle, Events, CommandInteractionOptionResolver } from 'discord.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

//isDisabled, on timeout --> the prev and next buttons will pass true so the buttons no longer work
//use the userID to create a custom button that can only be enabled by the one who made the message
export const makeButtons = (isDisabled, pageNum, userID) => {

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
        .setCustomId(`PrevId+${userID}`)
        .setLabel('Prev')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(disablePrev);

    const button2 = new ButtonBuilder()
        .setCustomId(`NextId+${userID}`)
        .setLabel('Next')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(disableNext);

    return [button1, button2]
}

export function betButton(userID){
    const bet_button = new ButtonBuilder()
        .setCustomId(`Bet+${userID}`)
        .setLabel(`Bet On this Stat`)
        .setStyle(ButtonStyle.Primary)
        .setDisabled(false);

    return bet_button
}

export async function getLOLStats(SUMMONER_NAME, TAGLINE, ACCOUNT_REGION, REGION, API_KEY, userID){
    const summoner_info = await getSummonerInfo(ACCOUNT_REGION, SUMMONER_NAME, TAGLINE, API_KEY);

    const puuid = summoner_info["puuid"];

    const count = 36;

    const match_ids = await getLOLMatchIDs(REGION, API_KEY, puuid, count);

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
            const match_stats = await getLOLMatchStats(REGION, API_KEY, match_ids[i]);

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
        descriptions.push(generateLOLDescription(kills[i], deaths[i], assists[i], matchDates[i], champions[i]));
    }

    //map of buffers
    let buffers = {};

    //returns buffers of the graphs, add them to a map
    buffers['killBuffer'] = await graphLOLData(kills, matchDates, 'Kills');
    buffers['deathBuffer'] = await graphLOLData(deaths, matchDates, 'Deaths');
    buffers['assistBuffer'] = await graphLOLData(assists, matchDates, 'Assists');

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
                    .setImage('attachment://deaths_graph.png');

    const embed3 = new EmbedBuilder()
                    .setTitle('Assists Per Game')
                    .setDescription(`${descriptions[0]}
                                     ${descriptions[1]}
                                     ${descriptions[2]}
                                     ${descriptions[3]}
                                     ${descriptions[4]}
                                     \nAssists Over the Last 5 Matches`)
                    .setColor('Purple')
                    .setImage('attachment://assists_graph.png');

    //three checks for each embed for the easter eggs
    const checkEE1 = getEasterEgg(SUMMONER_NAME, TAGLINE, embed1);
    const checkEE2 = getEasterEgg(SUMMONER_NAME, TAGLINE, embed2);
    const checkEE3 = getEasterEgg(SUMMONER_NAME, TAGLINE, embed3);

    //build each page
    //for image, despite variable attachments, every string will be attachment
    const embed = [embed1,embed2,embed3,];
    
    //buttons for previous and next
    const [prev, next] = makeButtons(false, 0, userID);
    const bet = betButton(userID);
    
    //create row for these actions
    const buttons = new ActionRowBuilder().addComponents(prev, next,bet);
    
    //pass array of pages, buttons, and array of attachments
    //Check for easter egg
    if(checkEE1 && checkEE2 && checkEE3){
        return [embed, buttons, [k_attachment, d_attachment, a_attachment], checkEE1]
    }

    return [embed, buttons, [k_attachment, d_attachment, a_attachment]]
}

export async function getTFTStats(SUMMONER_NAME, TAGLINE, ACCOUNT_REGION, REGION, API_KEY){

    const summoner_info = await getSummonerInfo(ACCOUNT_REGION, SUMMONER_NAME, TAGLINE, API_KEY);

    const puuid = summoner_info["puuid"];

    const match_ids = await getTFTMatchIDs(ACCOUNT_REGION, API_KEY, puuid, 10);

    //dates and placement for each game
    const placements = [];
    const match_dates = [];
    const descriptions = [];

    for(let i = 0; i < match_ids.length ; i++){

        const match_id = match_ids[i];

        const match_stats = await getTFTMatchStats(ACCOUNT_REGION, API_KEY, match_id);

        const participants = match_stats['info']['participants'];

        //retrieve day and month of each game
        const gameDate = new Date(match_stats['info']['game_datetime']);
        const gameDay = gameDate.getDate();
        const gameMonth = gameDate.getMonth() + 1;

        for(let j = 0; j < participants.length; j++){
            if(participants[j]['riotIdGameName'] === SUMMONER_NAME && participants[j]['riotIdTagline'] === TAGLINE) {
                const participant = participants[j];
                placements.push(participant["placement"]);
                match_dates.push({month: gameMonth, day: gameDay});
            }
        }
    }

    for(let i = 0; i < placements.length; i++){
        descriptions[i] = generateTFTDescription(match_dates[i], placements[i]);
    }

    //generate buffer for the TFT graph
    const buffer = await graphTFTData(placements, match_dates, 'Placement');
    //create attachment for embed files
    const attachment = new AttachmentBuilder(buffer, {name: 'placement_graph.png'})


    const embed1 = new EmbedBuilder()
                   .setTitle('TFT Placements')
                   .setDescription(`The placements of the last 10 matches:
                                    ${descriptions[9]}${descriptions[8]}${descriptions[7]}${descriptions[6]}${descriptions[5]}
                                    ${descriptions[4]}${descriptions[3]}${descriptions[2]}${descriptions[1]}${descriptions[0]}`)
                    .setColor('Purple')
                   .setImage('attachment://placement_graph.png');

    const EECheck1 = getEasterEgg(SUMMONER_NAME, TAGLINE, embed1);

    if(EECheck1)
        return [embed1, attachment, EECheck1];

    return [embed1, attachment];
}

export function generateLOLDescription(kills, deaths, assists, matchDate, champion){

    return `${matchDate['month']}/${matchDate['day']} ${champion["champ"]} (${champion["role"]}): ${kills}/${deaths}/${assists}`
}

export function generateTFTDescription(matchDate, placement){

    if(placement === 1){
        return `1️⃣ `
    }
    else if(placement === 2){
        return `2️⃣ `
    }
    else if (placement === 3){
        return `3️⃣ `
    }
    else if (placement === 4){
        return `4️⃣ `
    }
    else if (placement === 5){
        return `5️⃣ `
    }
    else if (placement === 6){
        return `6️⃣ `
    }
    else if (placement === 7){
        return `7️⃣ `
    }
    else if (placement === 8){
        return `8️⃣ `
    }
    else{
        return 'ERROR finding positions'
    }
}

function getEasterEgg(SUMMONER_NAME, TAGLINE, embed){

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
            embed.setThumbnail(`attachment://danny_icon.JPG`);
            //embed2.setThumbnail(`attachment://danny_icon.JPG`);
            //embed3.setThumbnail(`attachment://danny_icon.JPG`);

            //create attachment for embed of the image
            thumbnailAttachment = new AttachmentBuilder(imagePath);

        }
        else if(SUMMONER_NAME === 'Quandale Dingle' && TAGLINE === 'CHIMP'){
            const imagePath = path.join(__dirname, 'assets', 'jordan_icon.JPG');
            embed.setThumbnail(`attachment://jordan_icon.JPG`);

            thumbnailAttachment = new AttachmentBuilder(imagePath);
        }
        else if(SUMMONER_NAME === 'Pandaras Box' && TAGLINE === 'Oreo'){
            const imagePath = path.join(__dirname, 'assets', 'johnny_icon.JPG');
            embed.setThumbnail(`attachment://johnny_icon.JPG`);
            thumbnailAttachment = new AttachmentBuilder(imagePath);
        }
    }
    else{
        return null;
    }

    return thumbnailAttachment
}
