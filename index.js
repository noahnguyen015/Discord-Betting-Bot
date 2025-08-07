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

let SUMMONER_NAME = '';
let TAGLINE = '';
const ACCOUNT_REGION = 'americas' //accounts are global, just use any endpoints americas/europe/asia
const REGION = 'americas' //for game data like matches and stats once you get PUUID which is regions-specific
const API_KEY = process.env.API_KEY; //RIOT developer API key

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
    //whether the message comes from bot
    if (message.author.bot) 
        return;

    const userID = message.author.id;

    //regex to include characters in between quotes or without quotes or spaces
    const args = message.content.match(/(?:[^\s"]+|"[^"]*")+/g);

    //grab the first command to check if correct
    const cmd = args.shift().toLowerCase();

    //for information (ss = summoner stats)
    if (cmd === '$slol') {

        //more than 1 argument check
        if(args.length <= 0){
            message.channel.send('❗ Please enter the summoner name with the command $ss "SummonerName#TAG"');
            return
        }

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

        try{
            message.channel.send(`The current summoner is: ${SUMMONER_NAME} \nThe tag is ${TAGLINE}`);

            //get the buttons and embed pages
            const pages = await getLOLStats(SUMMONER_NAME, TAGLINE, ACCOUNT_REGION, REGION, API_KEY, userID);

            if(!pages){
                message.channel.send('❌ Insufficient Number of Matches Found. Has this user played enough games?"');
                throw new Error('Error has occured; Insufficient or Unretrievable data');
            }

            let currentPage = 0;

            //build the embedded message
            //send the pages over starting with first page, and the buttons, then the attachment variables
            //check the length > 3? means easter egg is there, if not then just use the graph, else use the thumbnail
            const embed = await message.channel.send({embeds: [pages[0][0]], 
                                                    components: [pages[1]],
                                                    files: (pages.length > 3)? [pages[2][0], pages[3]] : [pages[2][0]],
                                                    });

            //look for interaction, keep u for 4 minutes 240__000 means 240 seconds
            const collector = embed.createMessageComponentCollector({time: 240_000});

            //collect interaction
            collector.on('collect', async (interaction) => {

                //make sure the person that made the button can interact with it
                if(interaction.customId === `PrevId+${interaction.user.id}` || interaction.customId === `NextId+${interaction.user.id}`) {
                    //check if the pressed button was the next or previous button and if the user is correct
                    if(interaction.customId === `PrevId+${interaction.user.id}` && currentPage > 0){
                        currentPage--;
                    }
                    else if(interaction.customId === `NextId+${interaction.user.id}` && (0 < currentPage < pages[0].length-1)){
                        currentPage++;
                    }

                    //build new clones of buttons where false = not expired, currentPage for correct buttons
                    //build new bet button for the current parameter
                    const [prev, next] = makeButtons(false, currentPage, userID);
                    const bet = betButton(userID);

                    //throw into action row
                    //one row for the 1. navigation of the stats, 2. for the button for intiating a bet
                    const buttons = new ActionRowBuilder().addComponents(prev, next, bet);

                    //update the embed page with the previous or next page
                    //response to new interactions
                    await interaction.update({embeds: [pages[0][currentPage]], 
                                            components: [buttons], 
                                            files: (pages.length > 3)? [pages[2][currentPage], pages[3]]: [pages[2][currentPage]],});
                }
                //check if the button pressed was the correct person
                else if(interaction.customId === `Bet+${interaction.user.id}`){

                    currentPage = -1;

                    const betEmbed = new EmbedBuilder()
                                     .setTitle('Bet Commencing')
                                     .setDescription('Bet is currently being held ...........')
                                     .setColor('Blue');
                    
                    //edit to new embed for the betting
                    await embed.edit({embeds: [betEmbed],
                                      components: [],
                                      files: [],
                                    });
                }
            });

            //handles the timeout
            collector.on('end', async () => {

                if(currentPage === -1){
                    const betEmbed = new EmbedBuilder()
                                    .setTitle('Bet Expired')
                                    .setDescription('The match was not detected and the bet has expired')
                                    .setColor('Blue');
                    await embed.edit({embeds: [betEmbed],
                                      components: [],
                                      files: [],
                                    });
                }
                else{
                    //build new clones of buttons
                    const [prev, next] = makeButtons(true, currentPage, userID);
                    const bet = betButton(userID);
                    const buttons = new ActionRowBuilder().addComponents(prev, next, bet);

                    //edit message directly with await embed.edit (no interaction causes change)
                    await embed.edit({embeds: [pages[0][currentPage]], 
                                    components: [buttons], 
                                    files: (pages.length > 3)? [pages[2][currentPage], pages[3]]: [pages[2][currentPage]],});
                }
            });
        }
        catch(error){
            console.error(`Error Caught: ${error.message}`);
        }
    }
    else if(cmd === '$stft'){

        //more than 1 argument check
        if(args.length <= 0){
            message.channel.send('❗ Please enter the summoner name with the command $ss "SummonerName#TAG"');
            return
        }

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

        try{
            message.channel.send(`The current summoner is: ${SUMMONER_NAME} \nThe tag is ${TAGLINE}`);

            //get the buttons and embed pages
            const pages = await getTFTStats(SUMMONER_NAME, TAGLINE, ACCOUNT_REGION, REGION, API_KEY);

            if(!pages){
                message.channel.send('❌ Insufficient Number of Matches Found. Has this user played enough games?"');
                throw new Error('Error has occured; Insufficient or Unretrievable data');
            }

            const embed = await message.channel.send({embeds: [pages[0]],
                                                      files: (pages.length > 2)? [pages[1], pages[2]]: [pages[1]]});

            //look for interaction, keep u for 4 minutes 240__000 means 240 seconds
            const collector = embed.createMessageComponentCollector({time: 240_000});

            //collect interaction
            collector.on('collect', async (interaction) => {
            });

            //handles the timeout
            collector.on('end', async () => {
            });


        }catch(error) {
            console.error(`Error Caught: ${error.message}`);
        }
    }
    else if(cmd === '$wallet') {
        const amount = getWallet(userID);
        message.channel.send(`You currently have $${amount} 💎`);
    }
    else{
        message.channel.send('❗ Please check the name of the command!');
    }
});

client.login(DISCORD_TOKEN);
