const axios = require("axios");
const fs = require("fs");
const { exec } = require("child_process");
const moment = require("moment");

var us_states = require('../us_state.js');


/**
 * 
 * @param {object} voteData JSON-fied vote Data from EDN
 */
const destructureVoteData = (voteData) => {
  const { description } = voteData;
  const date = voteData["date"];
  const districtDivisions = voteData["district-divisions"][0];
  const ocdID = districtDivisions["ocd-id"];
  const voterRegistrationAuthorityLevel = districtDivisions["voter-registration-authority-level"];
  const electionAuthorityLevel = districtDivisions["election-authority-level"];
  
  let votingMethods = districtDivisions["voting-methods"];
  let votingRegistrationMethods = districtDivisions["voter-registration-methods"];
  
  const primaryVotingMethodSource = districtDivisions["primary-voting-method-source"];
  const type = voteData["type"];
  const source = {
    ...voteData["source"],
    date: moment(date).format('MMMM Do YYYY, h:mm:ss a')
  };
  const pollingPlaceUrl = voteData["polling-place-url"];
  const id = voteData["id"];
  const population = voteData["population"];
  const website = voteData["website"];
  const pollingPlaceUrlShortened = voteData["polling-place-url-shortened"];
  
  return { 
    description,
    date, 
    districtDivisions, 
    ocdID, 
    voterRegistrationAuthorityLevel, 
    electionAuthorityLevel, 
    votingMethods, 
    votingRegistrationMethods,
    primaryVotingMethodSource,
    type,
    source,
    pollingPlaceUrl,
    id,
    population,
    website,
    pollingPlaceUrlShortened,
  }
}

const home = (req, res, next) => {
  res.render("index", { title: 'Find My Election', states: us_states });
}

/**
 * 
 * @param {*} req Request with query params state & city
 */
const upcoming = (req, res, next) => {
  const { state, city } = req.query;
  if(state && city) {
    axios.get(`https://api.turbovote.org/elections/upcoming?district-divisions=ocd-division/country:us/state:${state.toLowerCase()},ocd-division/country:us/state:${state.toLowerCase()}/place:${city.toLowerCase()}`)
    .then((response) => {
      const { data } = response;
      /**
       * Save the file as sync as cli have to be run after it's saved.
       */
      fs.writeFileSync("./data.edn", data, (err) => {
        if(err) {
          console.log("something went wrong!")
        }
        console.log("EDN Data saved");
      })

      /**
       * @requires child_process 
       * @returns get JSON Formate data from EDN Data
       * @param {stdout} JSON datatype
       */
      exec(`cat ./data.edn | jet --from edn --to json`, (err, stdout, stderr) => {
        if(err) {
          console.log(err);
        }
        const jsonVoteData = JSON.parse(stdout)[0];
        /**
         * destructure data @see destructureVoteData()
         */
        const {
          description,
          date, 
          ocdID, 
          voterRegistrationAuthorityLevel, 
          electionAuthorityLevel, 
          votingMethods,
          votingRegistrationMethods,
          primaryVotingMethodSource,
          type,
          source,
          pollingPlaceUrl,
          id,
          population,
          website,
          pollingPlaceUrlShortened,
        } = destructureVoteData(jsonVoteData);

        /**
         * @function getVotingMethods() get voting methods data per type;
         */
        function getVotingMethods(votingMethods) {
          return votingMethods.reduce((res, el) => {
            switch(el.type) {
              case "in-person":
                return [
                  ...res,
                  {
                    primary: true,
                    instructions: el.instructions["voting-id"],
                    type: el.type,
                    excuseRequired: el["excuse-required"],
                  }
                ]
              case "by-mail":
                return [
                  ...res,
                  {
                    primary: false,
                    type: el.type,
                    excuseRequired: el["excuse-required"],
                    ballotRequestDeadlineReceived: 
                      moment(el["ballot-request-deadline-received"]).format('MMMM Do YYYY, h:mm:ss a'),
                    acceptableForms: el["acceptable-forms"][0]
                  }
                ]
              case "early-voting":
                return [
                  ...res,
                  {
                    primary: false,
                    start: moment(el.start).format('MMMM Do YYYY, h:mm:ss a'),
                    type: el.type,
                    excuseRequired: el["excuse-required"],
                    end: moment(el.end).format('MMMM Do YYYY, h:mm:ss a')
                  }
                ]
              default:
                return res;
            }
          }, [])
        }

        
        /**
         * @function getVotingRegistrationMethods()
         * get voting registration methods data per type
         */
        function getVotingRegistrationMethods(votingRegistrationMethods) {
          return votingRegistrationMethods.reduce((res, el) => {
            switch(el.type) {
              case "online":
                return [
                  ...res,
                  {
                    registration: el.instructions.registration,
                    type: el.type,
                    deadline: moment(el["deadline-online"]).format('MMMM Do YYYY, h:mm:ss a'),
                    url: el.url,
                  }
                ]
                case "by-mail":
                  return [
                    ...res,
                    {
                      signature: el.instructions.signature,
                      idNumber: el.instructions.idnumber,
                      type: el.type,
                      acceptableForms: el["acceptable-forms"][0]
                    }
                  ]
                }
            }, []);
          }

        const voteRegistrationMethods = getVotingRegistrationMethods(votingRegistrationMethods)
        const voteMethods = getVotingMethods(votingMethods)

        const voteData = {
          description,
          date,
          ocdID,
          voterRegistrationAuthorityLevel,
          electionAuthorityLevel,
          voteMethods,
          voteRegistrationMethods,
          primaryVotingMethodSource,
          type,
          source,
          pollingPlaceUrl,
          id,
          population,
          website,
          pollingPlaceUrlShortened
        };

        res.render('upcoming', voteData);
      })
    })
  } else {
    res.status(404).send("No Data Found!");
  }
}

module.exports = {
  upcoming,
  home
}