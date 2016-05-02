'use strict';

var scrapeIt = require('scrape-it');
var _ = require('lodash');

var URL_PATTERN = 'http://fia-fe.com/en/all-results/season-{{season}}.aspx';
var SEASONS = 2;

for (var season = 1; season <= SEASONS; season++) {
  var currentUrl = URL_PATTERN.replace('{{season}}', season);

  scrapeIt(currentUrl, {
    season: 'h1',
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
            return (words.length > 0) ? words[1] : false;
          }
        },
        date: {
          selector: '.dtc',
          how: function(data) {
            var words = _.words(data.text());
            return (words.length > 2) ? words[2] + ' ' + words[3] + ' ' + words[4] : false;
          }
        }
      }
    }
  }, function(err, data) {
    if (err) {
      console.log('Error :', err);
      return false;
    }

    console.log('Load season: ' + data.season);
  });
}
