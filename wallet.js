import db from './database.js';

export function verifyUser(userID){
    //fetch all columns from a table to find a user_id that matches up (? = replaced by userID in function)
    const row = db.prepare('SELECT * FROM mywallet WHERE user_id = ?').get(userID);

    //doesn't exists yet? make a entry for them will a default value of 1000
    if(!row){
        db.prepare('INSERT INTO mywallet (user_id, balance) VALUES (?, ?)').run(userID, 1000);
    }
}

export function getWallet(userID){
    //make sure user is in the database
    verifyUser(userID);

    //gets the row for that user and return the balance or null
    const row = db.prepare('SELECT balance FROM mywallet WHERE user_id = ?').get(userID);

    if(!row)
        return null

    return row['balance']
}

export function addWallet(userID, value){
    verifyUser(userID);

    //update the amount/add to the amount of current wallet
    //.run parameters will be in place of the ?s
    db.prepare('UPDATE mywallet SET balance = balance + ? WHERE user_id = ?').run(userID, value);

}

export function subWallet(userID, value){
    verifyUser(userID);

    //update the amount/add to the amount of current wallet
    //.run parameters will be in place of the ?s
    db.prepare('UPDATE mywallet SET balance = balance - ? WHERE user_id = ?').run(userID, value);

}