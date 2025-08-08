import Bottleneck from 'bottleneck'

//Flow of League API = getSummonerInfo --> getLOLMatchIDs --> getLOLMatchStats
//Flow of TFT API = getSummonerInfo --> getTFTMatchIDs --> getTFTMatchStats


//Bottleneck settings
const limit = new Bottleneck ({resevoir: 12, //max 20 requests
                                resevoirRefreshAmount: 12, //the amount of refills (how many requests to add when refreshes)
                                reservoirRefreshInterval: 1000 })//every 1 second (how long till full refill)


export async function getSummonerInfo(ACCOUNT_REGION, SUMMONER_NAME, TAGLINE, API_KEY){
    //grab summoner information from the RIOT API

    const response = await fetch(`https://${ACCOUNT_REGION}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${SUMMONER_NAME}/${TAGLINE}`,
    {
        headers: {'X-Riot-Token': API_KEY}
    });

    if(!response.ok){
        console.error(`Fetch for summoner info failed, Please check API; Error (${response.status})`);
    }
    const reply = await response.json();

    return reply

}

export async function getLOLMatchIDs(REGION, API_KEY, puuid, count){

    //match id fetch for the last 5 matches
    const response = await fetch(`https://${REGION}.api.riotgames.com/lol/match/v5/matches/by-puuid/${puuid}/ids?start=0&count=${count}`,
    {
        headers: {'X-Riot-Token': API_KEY}
    });

    if(!response.ok){
        console.error(`Fetch for match Ids failed; Please check API; Error (${response.status})`);
    }

    const reply = await response.json();

    return reply
}

export async function getLOLMatchStats(REGION, API_KEY, match_id){

    //schedule the bottleneck based on rate limit
    //queues the reply if the api is at the limit
    return limit.schedule(async () => {
        //Fetch the stats of the match from the match_id
        const response = await fetch(`https://${REGION}.api.riotgames.com/lol/match/v5/matches/${match_id}`,
        {
            headers: {'X-Riot-Token': API_KEY}
        });

        if(!response.ok){
            console.error(`Fetch for Match Stats failed; Please Check API; Error (${response.status})`);
        }

        const reply = await response.json();
        return reply
    }
    );
}

export async function getTFTMatchIDs(REGION, API_KEY, puuid, count){

    //match id fetch for the last 5 matches
    const response = await fetch(`https://${REGION}.api.riotgames.com/tft/match/v1/matches/by-puuid/${puuid}/ids?start=0&count=${count}`,
    {
        headers: {'X-Riot-Token': API_KEY}
    });

    if(!response.ok){
        console.error(`Fetch for match Ids failed; Please check API; Error (${response.status})`);
    }

    const reply = await response.json();

    return reply
}

export async function getTFTMatchStats(REGION, API_KEY, match_id){

    return limit.schedule(async () => {
    //match id fetch for the last 5 matches
    const response = await fetch(`https://${REGION}.api.riotgames.com/tft/match/v1/matches/${match_id}`,
    {
        headers: {'X-Riot-Token': API_KEY}
    });

    if(!response.ok){
        console.error(`Fetch for match Ids failed; Please check API; Error (${response.status})`);
    }

    const reply = await response.json();

    return reply
    }
    );
}