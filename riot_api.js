export async function getSummonerInfo(ACCOUNT_REGION, SUMMONER_NAME, TAGLINE, API_KEY){

    //grab summoner information from the RIOT API
    //const response = await fetch(`https://${ACCOUNT_REGION}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${SUMMONER_NAME}/${TAGLINE}`,
    const response = await fetch(`https://${ACCOUNT_REGION}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/kraneh/NA1`,
    {
        headers: {'X-Riot-Token': API_KEY}
    });

    if(!response.ok) 
        console.log(`Fetch for summoner info failed :( (${response.status})`);

    const reply = await response.json();

    return reply
}

export async function getMatchIDs(REGION, API_KEY, puuid, count){

    //match id fetch for the last 5 matches
    const response = await fetch(`https://${REGION}.api.riotgames.com/lol/match/v5/matches/by-puuid/${puuid}/ids?count=${count}`,
    {
        headers: {'X-Riot-Token': API_KEY}
    });

    if(!response.ok) 
        console.log(`Fetch for match Ids failed :( (${response.status})`);

    const reply = await response.json();

    return reply
}

export async function getMatchStats(REGION, API_KEY, match_id){

    //Fetch the stats of the match from the match_id
    const response = await fetch(`https://${REGION}.api.riotgames.com/lol/match/v5/matches/${match_id}`,
    {
        headers: {'X-Riot-Token': API_KEY}
    });

    if(!response.ok) 
        console.log(`Fetch for Match Stats failed :( (${response.status})`);

    const reply = await response.json();

    return reply
}