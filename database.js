import Database from 'better-sqlite3'

//create the database
const db = new Database('./wallet.db');

/*SQL statement creater (like a query)
    - create a table called mywallet if it doesn't exist, error if one made alreayd
    - users will have unique entry in table (based on discord id)
        - TEXT = stores strings (Discord IDs)
        - PRIMARY KEY = no duplicates
    - balance stores the current balance
    - INTEGER is the type for numbers
    - DEFAULT # if no value is specified then default is #

    executes the statement with run();
*/
db.prepare(`CREATE TABLE IF NOT EXISTS mywallet (
            user_id TEXT PRIMARY KEY,
            balance INTEGER DEFAULT 1000
            )
            `).run();

export default db;