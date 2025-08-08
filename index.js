import { graphLOLData } from './chart.js';
import { getSummonerInfo, getLOLMatchIDs, getLOLMatchStats, getTFTMatchIDs, getTFTMatchStats } from './riot_api.js'
import { makeButtons, getLOLStats, getTFTStats, generateLOLDescription, betButton} from './stats.js'
import { verifyUser, getWallet, addWallet, subWallet } from './wallet.js'
import { Client, GatewayIntentBits, EmbedBuilder, ButtonBuilder, ActionRowBuilder, AttachmentBuilder, ButtonStyle, Events, CommandInteractionOptionResolver } from 'discord.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

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
    2. event = messageCreate, so a new message
    3. arrow function everytime message is made
    4. syntax: 
    content = text content, 
    author = user who sent it, 
    channel = channel it was sent in,
    guild = server it is in 
*/
client.on('messageCreate', async (message) => {

    let SUMMONER_NAME = '';
    let TAGLINE = '';
    const ACCOUNT_REGION = 'americas' //accounts are global, just use any endpoints americas/europe/asia
    const REGION = 'americas' //for game data like matches and stats once you get PUUID which is regions-specific
    const API_KEY = process.env.API_KEY; //RIOT developer API key

    //whether the message comes from bot
    if (message.author.bot) 
        return;

    if (message.channel.name !== 'robot-testing')
        return

    const userID = message.author.id;

    //regex to include characters in between quotes or without quotes or spaces
    const args = message.content.match(/(?:[^\s"]+|"[^"]*")+/g);

    //grab the first command to check if correct
    const cmd = args.shift().toLowerCase();

    //for information (ss = summoner stats)
    if (cmd === '?slol') {

        //more than 1 argument check
        if(args.length <= 0){
            message.channel.send('❗ Please enter the summoner name with the command ?slol "SummonerName#TAG"');
            return
        }

        //first index after cmd is 1st argument, check for quotes
        if (!args[0].startsWith('"') || !args[0].endsWith('"')){
            message.channel.send('❗ Uh-Oh! make sure to quote your summoner name! ?slol "SummonerName#TAG"');
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
            message.channel.send('❗ Tag Error, please check your tag! ?slol "SummonerName#TAG"');
            return
        }

        //split up name and the tagline for the summoner/riot account
        const tagidx = summoner.indexOf('#');
        SUMMONER_NAME = summoner.slice(0, tagidx).trim();
        TAGLINE = summoner.slice(tagidx+1).trim();

        try{
            //get the buttons and embed pages
            const pages = await getLOLStats(SUMMONER_NAME, TAGLINE, ACCOUNT_REGION, REGION, API_KEY, userID);

            if(!pages){
                message.channel.send('❌ Error Fetching Match Data"');
                throw new Error('Error has occured; Insufficient or Unretrievable data');
            }

            let currentPage = 0;
            let isBetting = 0;

            //build the embedded message
            //send the pages over starting with first page, and the buttons, then the attachment variables
            //check the length > 3? means easter egg is there, if not then just use the graph, else use the thumbnail
            const embed = await message.channel.send({embeds: [pages['embed'][0]], 
                                                    components: [pages['nav_buttons'], pages['bet_buttons']],
                                                    files: ('easteregg' in pages)? [pages['attachments'][0], pages['easteregg']] : [pages['attachments'][0]],
                                                    });

            //look for interaction, keep u for 4 minutes 240__000 means 240 seconds
            const collector = embed.createMessageComponentCollector({time: 60_000});

            let pollMatches = null;

            //collect interaction
            collector.on('collect', async (interaction) => {

                //make sure the person that made the button can interact with it
                if(interaction.customId === `PrevId+${interaction.user.id}` || interaction.customId === `NextId+${interaction.user.id}`) {
                    //check if the pressed button was the next or previous button and if the user is correct
                    if(interaction.customId === `PrevId+${interaction.user.id}` && currentPage > 0){
                        currentPage--;
                    }
                    else if(interaction.customId === `NextId+${interaction.user.id}` && (0 < currentPage < 3)){
                        currentPage++;
                    }

                    //build new clones of buttons where false = not expired, currentPage for correct buttons
                    //build new bet button for the current parameter
                    const [prev, next] = makeButtons(false, currentPage, userID);
                    const betUnder = betButton(userID, 'UNDER', false);
                    const betOver = betButton(userID, 'OVER', false);

                    //throw into action row
                    //one row for the 1. navigation of the stats, 2. for the button for intiating a bet
                    const nav_clone = new ActionRowBuilder().addComponents(prev, next);
                    const bet_clone = new ActionRowBuilder().addComponents(betUnder, betOver);

                    //update the embed page with the previous or next page
                    //response to new interactions
                    await interaction.update({embeds: [pages['embed'][currentPage]], 
                                            components: [nav_clone, bet_clone], 
                                            files: ('easteregg' in pages)? [pages['attachments'][currentPage], pages['easteregg']]: [pages['attachments'][currentPage]],});
                }
                //check if the button pressed was the correct person
                else if(interaction.customId === `Bet+${interaction.user.id}+UNDER` || interaction.customId === `Bet+${interaction.user.id}+OVER`) {

                    let betType = '';

                    if(interaction.customId === `Bet+${interaction.user.id}+UNDER`)
                        betType = 'UNDER'
                    else 
                        betType = 'OVER'

                    isBetting = true;
                    let line = '';
                    let average = -1;

                    if(currentPage === 0){
                        line = 'Kills';
                        average = pages['average']['kills'];
                    }else if(currentPage === 1){
                        line = 'Deaths';
                        average = pages['average']['deaths'];
                    }else if(currentPage === 2){
                        line = 'Assists';
                        average = pages['average']['assists'];
                    }else{
                        line = 'ERROR';
                        average = -1;
                    }

                    const betEmbed = new EmbedBuilder()
                                     .setTitle('Bet is Placed!')
                                     .setDescription(`Your Current Line:
                                                     ${SUMMONER_NAME}#${TAGLINE} ${betType} ${average} ${line} (...)`)
                                     .setColor('Green');
                    
                    //edit to new embed for the betting
                    await embed.edit({embeds: [betEmbed],
                                      components: [],
                                      files: [],
                                    });

                    const current_matches = pages['match_ids'];
                    
                    //check for the data every 10 minutes
                    pollMatches = setInterval(async () => {

                        console.log('Polling LOL Data...');

                        let current_match = current_matches[0];
                        let game_type = -1;
                        let matchDuration = -1; 

                        const new_matches = await getLOLMatchIds(ACCOUNT_REGION, API_KEY, pages['puuid'], 5);

                        if(!new_matches)
                            throw new Error('Polling for new LOL match data failed')

                        //found new match grab the queue type and duration
                        if(new_matches[0] !== current_match){
                            console.log(`NEW LOL MATCH DETECTED for ${SUMMONER_NAME}#${TAGLINE}`);
                            const check_data = await getTFTMatchStats(ACCOUNT_REGION, API_KEY, new_matches[0]);

                            game_type = check_data['info']['queueId'];
                            matchDuration = match_stats['info']['gameDuration']; 
                        }

                        //if it meets then perform the check for stats
                        if((game_type === 400 || game_type === 420 || game_type === 440) && matchDuration > 600){

                            console.log(`VERIFIED LOL MATCH for ${SUMMONER_NAME}#${TAGLINE}`);

                            isBetting = false;
                            resultFound = true;

                            clearInterval(pollMatches);
    
                            const new_data = await getTFTMatchStats(ACCOUNT_REGION, API_KEY, new_matches[0]);

                            if(!new_data)
                                throw new Error('Unable to get data for the new matches')

                            const participants = new_data['info']['participants'];
                            let newStats = {};

                            for(let i = 0; i < participants.length; i++){
                                if((participants[i]['riotIdGameName'] === SUMMONER_NAME) && (participants[i]['riotIdTagline'] === TAGLINE)) {
                                    const participant = participants[i];
                                    newStats['Kills'] = participant['kills'];
                                    newStats['Deaths'] = participant['deaths'];
                                    newStats['Assists'] = participant['assists'];
                                }
                            }

                            //show the result on the embed
                            if(betType === 'UNDER'){
                                if(newPlacement < average){
                                    const resultEmbed = new EmbedBuilder()
                                                    .setTitle('Result of Bet: Win! ✨')
                                                    .setDescription(`Your Current Line: 
                                                                    ${SUMMONER_NAME}#${TAGLINE} ${betType} ${average} for ${line} Result: (${newStats[line]}) 🟩
                                                                    \nYou have won $200 💎`)
                                                    .setColor('Green');
                                    
                                    //edit to new embed for the betting
                                    await embed.edit({embeds: [resultEmbed],
                                                    components: [],
                                                    files: [],
                                                    });

                                    addWallet(userID, 200);
                                }
                                else if(newPlacement > average){
                                    const resultEmbed = new EmbedBuilder()
                                                    .setTitle('Result of Bet: Loss ❌')
                                                    .setDescription(`Your Current Line: 
                                                                    ${SUMMONER_NAME}#${TAGLINE} ${betType} ${average} for ${line} Result: (${newStats[line]}) 🟥`)
                                                    .setColor('Red');
                                    
                                    //edit to new embed for the betting
                                    await embed.edit({embeds: [resultEmbed],
                                                    components: [],
                                                    files: [],
                                                    });
                                }else{
                                    const resultEmbed = new EmbedBuilder()
                                                    .setTitle('Result of Bet: Tie ⬛')
                                                    .setDescription(`Your Current Line: 
                                                                    ${SUMMONER_NAME}#${TAGLINE} ${betType} ${average} for ${line} Result: (${newStats[line]}) ⬛
                                                                    \nBet being refunded...`)
                                                    .setColor('Grey');
                                    
                                    //edit to new embed for the betting
                                    await embed.edit({embeds: [resultEmbed],
                                                    components: [],
                                                    files: [],
                                                    });
                                }
                            }
                            else if(betType === 'OVER'){
                                if(newPlacement > average){
                                    const resultEmbed = new EmbedBuilder()
                                                    .setTitle('Result of Bet: Win! ✨')
                                                    .setDescription(`Your Current Line: 
                                                                    ${SUMMONER_NAME}#${TAGLINE} ${betType} ${average} for ${line} Result: (${newStats[line]}) 🟩
                                                                    \nYou have won $200 💎`)
                                                    .setColor('Green');
                                    
                                    //edit to new embed for the betting
                                    await embed.edit({embeds: [resultEmbed],
                                                    components: [],
                                                    files: [],
                                                    });
                                    
                                    addWallet(userID, 200);
                                }
                                else if(newPlacement > average){
                                    const resultEmbed = new EmbedBuilder()
                                                    .setTitle('Result of Bet: Loss ')
                                                    .setDescription(`Your Current Line: 
                                                                    ${SUMMONER_NAME}#${TAGLINE} ${betType} ${average} for ${line} Result: (${newStats[line]}) 🟥`)
                                                    .setColor('Red');
                                    
                                    //edit to new embed for the betting
                                    await embed.edit({embeds: [resultEmbed],
                                                    components: [],
                                                    files: [],
                                                    });
                                }
                                else {
                                    const resultEmbed = new EmbedBuilder()
                                                    .setTitle('Result of Bet: Tie')
                                                    .setDescription(`Your Current Line: 
                                                                    ${SUMMONER_NAME}#${TAGLINE} ${betType} ${average} for ${line} Result: (${newStats[line]}) ⬛
                                                                    \nYour Buy-In will be refunded shortly`)
                                                    .setColor('Grey');
                                    
                                    //edit to new embed for the betting
                                    await embed.edit({embeds: [resultEmbed],
                                                    components: [],
                                                    files: [],
                                                    });
                                }
                            }
                        }
                        //if not, set the last match to the current one, so it continues to check for new matches (doesn't check same one each time)
                        else{
                            console.log(`QUEUE found, but game_type == ${game_type}`);
                            current_match = new_matches[0];
                        }
                    },300_000); //10 minute = 600000, 5 minute = 300,000
                    
                }
            });

            //handles the timeout
            collector.on('end', async () => {

                //check if the bet expired or just the stat embedded pages
                if(isBetting){

                    clearInterval(pollMatches);

                    const betEmbed = new EmbedBuilder()
                                    .setTitle('Bet Expired')
                                    .setDescription('The match was not detected and the bet has expired')
                                    .setColor('Red');
                    await embed.edit({embeds: [betEmbed],
                                      components: [],
                                      files: [],
                                    });
                }
                else{
                    //check if it's already deleted
                    if(embed.deletable)
                        //delete the message 
                        await embed.delete();
                }
            });
        }
        catch(error){
            console.error(`Error Caught: ${error.message}`);
        }
    }
    else if(cmd === '?stft'){

        //more than 1 argument check
        if(args.length <= 0){
            message.channel.send('❗ Please enter the summoner name with the command ?stft "SummonerName#TAG"');
            return
        }

        //first index after cmd is 1st argument, check for quotes
        if (!args[0].startsWith('"') || !args[0].endsWith('"')){
            message.channel.send('❗ Uh-Oh! make sure to quote your summoner name! ?stft "SummonerName#TAG"');
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
            message.channel.send('❗ Tag Error, please check your tag! ?stft "SummonerName#TAG"');
            return
        }

        //split up name and the tagline for the summoner/riot account
        const tagidx = summoner.indexOf('#');
        SUMMONER_NAME = summoner.slice(0, tagidx).trim();
        TAGLINE = summoner.slice(tagidx+1).trim();
        try{

            let isBetting = false;
            let resultFound = false;

            //get the buttons and embed pages
            const pages = await getTFTStats(SUMMONER_NAME, TAGLINE, ACCOUNT_REGION, REGION, API_KEY, userID);

            if(!pages){
                message.channel.send('❌ Unable to Retrieve Match Data"');
                throw new Error('Error has occured; Insufficient or Unretrievable data');
            }

            const embed = await message.channel.send({embeds: [pages['embed']],
                                                      components: [pages['bet_buttons']],
                                                      files: ('easteregg' in pages)? [pages['attachment'], pages['easteregg']]: [pages['attachment']]});

            //look for interaction, keep up for 3_900_000 ms (1 hour 5 minutes) = 3,600,000 miliseconds
            ///separators _for clarity, 
            const collector = embed.createMessageComponentCollector({time: 3_900_000});

            //setup the interval outside the scope
            //checks for data periodically 
            let pollMatches = null;

            //collect interaction
            collector.on('collect', async (interaction) => {
                
                if(interaction.customId === `Bet+${interaction.user.id}+UNDER` || interaction.customId === `Bet+${interaction.user.id}+OVER`){

                    isBetting = true;
                    let betType = '';

                    if(interaction.customId === `Bet+${interaction.user.id}+UNDER`){
                        betType = 'UNDER'
                    }
                    else {
                        betType = 'OVER'
                    }

                    let line = 'Placement';

                    let average = pages['average'];

                    const betEmbed = new EmbedBuilder()
                                     .setTitle('Bet is Placed!')
                                     .setDescription(`Your Current Line: 
                                                     ${SUMMONER_NAME}#${TAGLINE} ${betType} ${average} for ${line} (...)`)
                                     .setColor('Purple');
                    
                    //edit to new embed for the betting
                    await embed.edit({embeds: [betEmbed],
                                      components: [],
                                      files: [],
                                    });

                    const current_matches = pages['match_ids'];
                    
                    //check for the data every 10 minutes
                    pollMatches = setInterval(async () => {

                        console.log('Polling for TFT matches...');

                        const new_matches = await getTFTMatchIDs(ACCOUNT_REGION, API_KEY, pages['puuid'], 5);

                        if(!new_matches)
                            throw new Error('Polling for new TFT match data failed')

                        if(new_matches[0] !== current_matches[0]){

                            console.log("TFT Match Found!");

                            isBetting = false;
                            resultFound = true;

                            clearInterval(pollMatches);
    
                            const new_data = await getTFTMatchStats(ACCOUNT_REGION, API_KEY, new_matches[0]);

                            if(!new_data)
                                throw new Error('Unable to get data for the new matches')

                            const participants = new_data['info']['participants'];
                            let newPlacement = -1;

                            for(let i = 0; i < participants.length; i++){
                                if((participants[i]['riotIdGameName'] === SUMMONER_NAME) && (participants[i]['riotIdTagline'] === TAGLINE)) {
                                    console.log(`${SUMMONER_NAME}#${TAGLINE} is equal to ${participants[i]['riotIdGameName']}#${participants[i]['riotIdTagline']}`);
                                    const participant = participants[i];
                                    console.log(participant["placement"]);
                                    newPlacement = participant["placement"];
                                }
                            }

                            //show the result on the embed
                            if(betType === 'UNDER'){
                                if(newPlacement < average){
                                    const resultEmbed = new EmbedBuilder()
                                                    .setTitle('Result of Bet: Win! ✨')
                                                    .setDescription(`Your Current Line: 
                                                                    ${SUMMONER_NAME}#${TAGLINE} ${betType} ${average} for ${line} Result: (${newPlacement}) 🟩
                                                                    \nYou have won $200 💎`)
                                                    .setColor('Green');
                                    
                                    //edit to new embed for the betting
                                    await embed.edit({embeds: [resultEmbed],
                                                    components: [],
                                                    files: [],
                                                    });

                                    addWallet(userID, 200);
                                }
                                else if(newPlacement > average){
                                    const resultEmbed = new EmbedBuilder()
                                                    .setTitle('Result of Bet: Loss ❌')
                                                    .setDescription(`Your Current Line: 
                                                                    ${SUMMONER_NAME}#${TAGLINE} ${betType} ${average} for ${line} Result: (${newPlacement}) 🟥`)
                                                    .setColor('Red');
                                    
                                    //edit to new embed for the betting
                                    await embed.edit({embeds: [resultEmbed],
                                                    components: [],
                                                    files: [],
                                                    });
                                }else{
                                    const resultEmbed = new EmbedBuilder()
                                                    .setTitle('Result of Bet: Tie ⬛')
                                                    .setDescription(`Your Current Line: 
                                                                    ${SUMMONER_NAME}#${TAGLINE} ${betType} ${average} for ${line} Result: (${newPlacement}) ⬛
                                                                    \nBet being refunded...`)
                                                    .setColor('Grey');
                                    
                                    //edit to new embed for the betting
                                    await embed.edit({embeds: [resultEmbed],
                                                    components: [],
                                                    files: [],
                                                    });
                                }
                            }
                            else if(betType === 'OVER'){
                                if(newPlacement > average){
                                    const resultEmbed = new EmbedBuilder()
                                                    .setTitle('Result of Bet: Win! ✨')
                                                    .setDescription(`Your Current Line: ${betType} ${average} for ${line} Result: (${newPlacement}) 🟩
                                                                    \nYou have won $200 💎`)
                                                    .setColor('Green');
                                    
                                    //edit to new embed for the betting
                                    await embed.edit({embeds: [resultEmbed],
                                                    components: [],
                                                    files: [],
                                                    });

                                    addWallet(userID, 200);
                                }
                                else if(newPlacement > average){
                                    const resultEmbed = new EmbedBuilder()
                                                    .setTitle('Result of Bet: Loss ')
                                                    .setDescription(`Your Current Line: ${betType} ${average} for ${line} Result: (${newPlacement}) 🟥`)
                                                    .setColor('Red');
                                    
                                    //edit to new embed for the betting
                                    await embed.edit({embeds: [resultEmbed],
                                                    components: [],
                                                    files: [],
                                                    });
                                }
                                else {
                                    const resultEmbed = new EmbedBuilder()
                                                    .setTitle('Result of Bet: Tie')
                                                    .setDescription(`Your Current Line: ${betType} ${average} for ${line} Result: (${newPlacement}) ⬛
                                                                    \nYour Buy-In will be refunded shortly`)
                                                    .setColor('Grey');
                                    
                                    //edit to new embed for the betting
                                    await embed.edit({embeds: [resultEmbed],
                                                    components: [],
                                                    files: [],
                                                    });

                                    addWallet(userID, 100);
                                }
                            }
                        }
                    }, 420_000); //10 minute = 600_000, 7minutes = 420_000
                }                                   
            });
            //handles the timeout
            collector.on('end', async () => {
                if(isBetting){
                    clearInterval(pollMatches);

                    const betEmbed = new EmbedBuilder()
                                    .setTitle('Bet Expired')
                                    .setDescription('The match was not detected and the bet has expired')
                                    .setColor('Red');

                    await embed.edit({embeds: [betEmbed],
                                      components: [],
                                      files: [],
                                    });
                }
                else if(resultFound){
                    clearInterval(pollMatches);                  
                }
                else{
                    if(embed.deletable)
                        //delete the message 
                        await embed.delete();
                }
                                                      
            });


        }catch(error) {
            console.error(`Error Caught: ${error.message}`);
        }
    }
    else if(cmd === '?wallet') {
        const amount = getWallet(userID);
        message.channel.send(`You currently have $${amount} 💎`);
    }
    else{
        message.channel.send('❗ Please check the name of the command!');
    }
});

client.login(DISCORD_TOKEN);
