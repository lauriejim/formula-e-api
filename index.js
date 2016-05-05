'use strict';

// dependencies
var _ = require('lodash');
var colors = require('colors/safe');
var scrapeIt = require('scrape-it');

// constants
var URL_PATTERN = 'http://fia-fe.com/en/all-results/season-{{season}}.aspx';
var SEASONS_COUNT = 2;
var CONFIG = {
  MONGO_PORT: 27017 || process.env.MONGO_PORT
}

// db connection
var mongoose = require('mongoose');
mongoose.connect('mongodb://localhost:' + CONFIG.MONGO_PORT + '/fe-data');

// db schema
var Schema = mongoose.Schema;

var gpShema = new Schema({
  season: String,
  name: String,
  date: Date,
  round: Number,
  link: String,
  race: [{
    position: Number,
    driver: String,
    team: String,
    time: {
      type: String,
      default: '-'
    },
    laps: {
      type: String,
      default: '-'
    },
    gap: {
      type: String,
      default: '-'
    },
    bestLap: {
      type: String,
      default: '-'
    }
  }],
  qualifying: [{
    position: Number,
    driver: String,
    team: String,
    time: {
      type: String,
      default: '-'
    },
    gap: {
      type: String,
      default: '-'
    }
  }],
  ref: {
    type: String,
    unique: true
  }
});

var GP = mongoose.model('gp', gpShema)

// config log's colors
colors.setTheme({
  info: 'green',
  warn: 'yellow',
  debug: 'blue',
  error: 'red'
});

// start scrapper code

for (var season = 1; season <= SEASONS_COUNT; season++) {
  var currentUrl = URL_PATTERN.replace('{{season}}', season);

  // get races of one gp
  scrapeIt(currentUrl, {
    year: 'h1',
    races: {
      listItem: '.event1',
      data: {
        name: 'h2',
        link: {
          selector: 'h2 a',
          attr: 'href'
        },
        round: {
          selector: '.dtc',
          how: function(data) {
            var words = _.words(data.text());
            return (!_.isNaN(parseInt(words[1]))) ? words[1] : false;
          }
        },
        date: {
          selector: '.dtc',
          how: function(data) {
            var words = _.words(data.text());
            return (words.length > 3) ? words[2] + ' ' + words[3] + ' ' + words[4] : false;
          }
        }
      }
    }
  }, function(err, seasons) {
    if (err) {
      console.log(colors.error('Fail to scrape season data:'), err);
      return false;
    }

    console.log(colors.info('Start scrapping:'), 'season ' + seasons.year);

    // loop in egp of one season
    _.forEach(seasons.races, function(egp) {
      if (egp.round) {

        // get egp informations
        scrapeIt(egp.link, {
          grids: {
            listItem: 'table.res_table',
            data: {
              name: 'h2',
              results: {
                listItem: 'tr.even, tr.odd',
                data: {
                  position: {
                    selector: 'td:first-child',
                    how: function(data) {
                      return parseInt(data.text());
                    }
                  },
                  driver: {
                    selector: 'td:nth-child(4)',
                    how: function(data) {
                      var words = _.words(data.text());
                      return _.join(_.difference(words, ['(P)', '(FL)']), ' ');
                    }
                  },
                  team: 'td:nth-child(5)',
                  laps: 'td:nth-child(6)',
                  time: 'td:nth-child(7)',
                  gap: 'td:nth-child(8)',
                  bestLap: 'td:nth-child(10)',
                }
              }
            }
          }
        }, function(err, result) {
          if (err) {
            console.log(colors.error('Fail to scrape egp results:'), err);
            return false;
          }

          // get race and qualifying results
          var race = _.find(result.grids, {'name': 'Race results'});
          var qualifying = _.find(result.grids, {'name': 'Qualifying results'});

          if (!race || !qualifying) return false;

          var newGP = new GP({
            season: seasons.year,
            name: egp.name,
            date: egp.date,
            round: egp.round,
            link: egp.link,
            race: race.results,
            qualifying: qualifying.results,
            ref: seasons.year + '-' + egp.round
          });

          // save new egp in database
          newGP.save(function(err) {
            var errorCode;
            if (err) {
              errorCode = err.message.split(' ')[0];

              if(errorCode === 'E11000'){
                console.log(colors.warn('This egp already exist in database:'), seasons.year + ' - ' + egp.name + ' - round: ' + egp.round);
              } else {
                console.log(colors.warn('Fail to insert in database: '), err.message);
              }

              return false;
            }

            console.log(colors.info('New egp in database:'), seasons.year + ' - ' + egp.name + ' - round: ' + egp.round);
          });
        });
      }
    });
  });
}
