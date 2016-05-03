'use strict';

// dependencies
var scrapeIt = require('scrape-it');
var _ = require('lodash');

// constants
var URL_PATTERN = 'http://fia-fe.com/en/all-results/season-{{season}}.aspx';
var SEASONS_COUNT = 2;

// db connection
var mongoose = require('mongoose');
mongoose.connect('mongodb://localhost:27017/fe-data');

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

// start scraper code

// loop on each seasons
for (var season = 1; season <= SEASONS_COUNT; season++) {
  var currentUrl = URL_PATTERN.replace('{{season}}', season);

  // scrape all gp of one season
  scrapeIt(currentUrl, {
    year: 'h1',
    gp: {
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
      console.log('Error get seasons:', err);
      return false;
    }

    console.log('Load season: ' + seasons.year);

    // scrape all table results one one gp
    _.forEach(seasons.gp, function(gp) {
      if (gp.round) {
        scrapeIt(gp.link, {
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
            console.log('Error get gp results:', err);
            return false;
          }

          // get Race and Qualifying results
          var race = _.find(result.grids, {'name': 'Race results'});
          var qualifying = _.find(result.grids, {'name': 'Qualifying results'});

          if (!race || !qualifying) return false;

          // create an entry in db
          var newGP = new GP({
            season: seasons.year,
            name: gp.name,
            date: gp.date,
            round: gp.round,
            link: gp.link,
            race: race.results,
            qualifying: qualifying.results,
            ref: seasons.year + '-' + gp.round
          });

          newGP.save(function(err) {
            if(err){
              console.log('Error insert in db: ', err);
            }
          });
        });
      }
    });
  });
}
