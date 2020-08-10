var POLL_INTERVAL = 1000;
var pollHandler;
var started = null;

function toggleStartButtons() {
  if (started) {
    $('#btn-start').hide();
    $('#btn-stop').show();
    $('#input-accounts').attr('disabled', 'disabled');
    $('#input-zipcodes').attr('disabled', 'disabled');
    $('.scanning').show();
  } else {
    $('#btn-stop').hide();
    $('#btn-start').show();
    $('#input-accounts').removeAttr('disabled');
    $('#input-zipcodes').removeAttr('disabled');
    $('.scanning').hide();
  }
}

function handleZipcode(data) {
  var html = '-';
  if (data.state.zipcode) {
    html = data.state.zipcode;
  }
  $('#status-current-zipcode').html(html);
}

function handleStreets(data) {
  var html = '';
  var streetsNum = 0;
  if (data.state.streets) {
    html = data.state.streets.map(function(item) {
      streetsNum++;

      // check if already scanned
      var isScanned = data.db.scannedStreets.find(function(scanned) {
        return scanned.city === item.city && scanned.street === item.street;
      });

      if (isScanned) {
        return '<span class="scanned-street">' + item.street + '</span>';
      }

      return '' + item.street;
    }).join(', ');
  }
  $('#status-streets').html(html);
  $('#status-streets-num').html('' + streetsNum);
}

function handleFound(data) {
  var html = '';
  var found = 0;
  if (data.db.found) {
    html = '<table class="table table-striped table-sm">';
    html += '<thead class="thead-light"><tr><th scope="col">Name</th>';
    html += '<th scope="col">Phone</th>';
    html += '<th scope="col">Address</th><th></th>';
    html += '</thead><tbody>';
    html += data.db.found.map(function(item) {
      found++;
      var h = '<tr><td class="col-name">' + item.name + '</td>';
      h += '<td class="col-phone">' + item.phone + '</td>';
      h += '<td class="col-address-1">' + item.address[0] + '</td>';
      h += '<td class="col-address-2">' + item.address[1] + '</td>';
      h += '</tr>';
      html += h;
      return h;
    }).join('');
    html += '</tbody></table>';
  }
  $('#status-found').html(html);
  $('#status-found-num').html('' + found);
}

function handleScannedZipcodes(data) {
  var html = '';
  if (data.db.scannedZipcodes) {
    html = data.db.scannedZipcodes.map(function(item) {
      return '<span class="badge badge-success scanned-zipcode">' + item.zipcode + '</span><br>';
    }).join('');
  }
  $('#status-scanned-zipcodes').html(html);
}

function handleInvalidAccounts(data) {
  var html = '';
  if (data.state.invalidAccounts) {
    html = data.state.invalidAccounts.map(function(item) {
      return '<span class="invalid-account">' + item + '</span> <span class="badge badge-danger">Wrong password!</span><br>';
    }).join('');
  }
  return html;
}

function handleAccounts(data) {
  var html = '';

  if (data.state.outOfAccounts) {
    html += '<div class="alert alert-warning">Ran out of accounts! Please provide more accounts or wait until the next month.</div>';
  }

  html += handleInvalidAccounts(data);
  if (data.db.consumedAccounts) {
    html += data.db.consumedAccounts.map(function(item) {
      return '<span class="consumed-account">' + item.username + '</span><br>';
    }).join('');
  }

  $('#status-consumed-accounts').html(html);
}

function handleData(data) {
  // console.log('data', data);
  handleZipcode(data);
  handleStreets(data);
  handleFound(data);
  handleScannedZipcodes(data);
  handleAccounts(data);
}

function fetchData() {
  $.get('/data', function(data) {
    handleData(data);
  });
}

function onStart() {
  started = Date.now();
  toggleStartButtons();

  var data = {
    accounts: $('#input-accounts').val(),
    zipcodes: $('#input-zipcodes').val(),
  };

  $.ajax({
    type: 'POST',
    url: '/start',
    contentType: 'application/json; charset=utf-8',
    data: JSON.stringify(data),
    dataType: 'json',
  })
    .done(function() {
      // start polling
      pollHandler = setInterval(fetchData, POLL_INTERVAL);
    });
}

function onStop() {
  started = null;
  toggleStartButtons();
  clearInterval(pollHandler);

  $.get('/stop', function(data) {
    // make sure we have latest data
    fetchData();
  });
}

function init() {
  toggleStartButtons();
  $('#btn-start').on('click', onStart);
  $('#btn-stop').on('click', onStop);

  // show latest status
  fetchData();
}

$(document).ready(function() {
  init();
});
