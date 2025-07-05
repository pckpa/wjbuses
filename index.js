const version = 250625;
const api = 'https://eggplant.pcws.kr/wjbuses/back/api2.php';
const setting = {
    autoLogin: true,
    autoSearch: null,
    receivePush: false
};
var buses = [];
var names = [];
var cardata = [];
var carindex = {};
var prevInput = '';
var logined = false;
var linelisted = false;
var scheduleLogMode = false;
var scheduleLogData;
var group = [
    ['211', '311'],
    ['814', '815'],
    ['503', '871', '872', '823', '842-1', '842-2', '831834', '922'],
    ['915'],
    ['407'],
    ['509'],
    ['747'],
    ['B3'],
    ['214', '215', '216', '313'],
    ['217', '314', '921'],
    ['864'],
    ['535']
];

function listBuses() {
    $.ajax({
        url: `./list.csv?${version}`
    }).done(function (data) {
        var output = '';
        data = data.split('\n');
        for (var i = 1; i < data.length; i++) {
            var line = data[i].split(',');
            if (line[0] == undefined) continue;
            buses.push(line[0]);
            cardata[line[0]] = {
                meta: `${line[1]} / ${line[3]} / ${line[2]}`,
                parking: null,
                schedule: {
                    date: null,
                    route: null,
                    driver: null,
                    reduce: 0
                }
            };
            output += `
                            <div id="car_${line[0]}" class="article">
                                <div class="number">${line[0]}</div>
                                <div class="detail">
                                ${line[1]} / ${line[3]}<br>${line[2]}
                                </div>
                            </div>
                        `;
        }
        $.ajax({
            url: `./parkingslot.js?${version}`,
            dataType: 'jsonp',
            jsonpCallback: 'callback',
            success: function (slot) {
                for (var i = 1; i < data.length; i++) {
                    var line = data[i].split(',');
                    if (line[0] == undefined) continue;
                    var pos = line[4].trim();
                    if (typeof (slot[line[1]][pos]) == 'string') pos = slot[line[1]][pos];
                    cardata[line[0]].parking = pos;
                }
                $('#table').html(output);
                if (setting.autoLogin) tryHashLogin();
            }
        })
    });
}

function schedules(req) {
    if (req == 'new') {
        if (logined) {
            $('#date').html('...');
            $.ajax({
                url: api + '?q=getList',
                dataType: 'jsonp',
                jsonpCallback: "callback",
                success: function (data) {
                    var list = [];
                    var checked = [];
                    var j = 0;
                    for (var i = 0; i < data.length; i++) {
                        var date = /(\d{4})년 (\d{1,2})월 (\d{1,2})일 \(([가-힣])\)/.exec(data[i][0]);
                        date = (new Date(date[1], date[2] - 1, date[3])).getTime();
                        if (checked.includes(date)) continue;
                        if (date < Date.now() - 158400000) continue;

                        checked.push(date);
                        //output.push(`<span style="cursor: pointer;" onclick="schedules('${data[i][0]}')">${data[i][0]}</span><br>`);
                        list.push(data[i][0]);
                        j++;
                    }
                    list.sort().reverse();
                    var output = '';
                    for (var i = 0; i < list.length; i++) {
                        output += `<span style="cursor: pointer;" onclick="schedules('${list[i]}')">${list[i]}</span><br>`;
                    }
                    output += '<div style="border-top: 1px solid #CCC; cursor: pointer;" onclick="showScheduleLog(false)">월간 배차이력</div>';
                    $('#dateselector').css('display', 'block');
                    $('#dateselector').html(output);
                    $('#blur').css('display', 'block');
                },
                error: function (xhr) {
                    console.log(xhr);
                }
            });
        }
        else {
            $('#loginform > #submit').attr("disabled", false);
            $('#login').css('display', 'block');
            $('#blur').css('display', 'block');
        }
    }
    else {
        $('#dateselector').css('display', 'none');
        $('#blur').css('display', 'none');
        scheduleLogMode = false;
        $.ajax({
            url: `${api}?q=getTable&t=${req}`,
            dataType: 'jsonp',
            jsonpCallback: "callback",
            success: function (data) {
                names = [];
                prevInput = '';
                carindex = {
                    0: []
                };

                //데이터처리ㅡㅡㅡ
                var rows = data.data.split('\n');
                var checked = [];
                for (var i = 0; i < rows.length - 1; i++) {
                    var row = rows[i].split(',');
                    checked.push(row[2]);

                    var driver = '';

                    if (row[4] != '') driver += `<span style="color: #CCC;">${row[3]}→</span>${row[4]}`;
                    else driver += row[3];
                    driver += ' / ';
                    if (row[6] != '') driver += `<span style="color: #CCC;">${row[5]}→</span>${row[6]}`;
                    else driver += row[5];

                    if (row[4] != '') names[row[4]] = row[2];
                    if (row[6] != '') names[row[6]] = row[2];

                    if (!buses.includes(row[2])) {
                        console.log(`정보 없는 차량: \n${row[2]}: ${row[0]}선 ${row[1]}번\n${driver}`);
                        cardata[row[2]] = {
                            meta: null,
                            schedule: {}
                        };
                    }

                    cardata[row[2]].schedule.date = req;
                    cardata[row[2]].schedule.route = `${row[0]}선 ${row[1]}번`;
                    cardata[row[2]].schedule.driver = driver;
                    cardata[row[2]].schedule.reduce = row[7];
                    if (row[7] == 1) cardata[row[2]].schedule.route += '(감차)';

                    if (typeof (carindex[row[0]]) == 'undefined') carindex[row[0]] = [];
                    carindex[row[0]][row[1]] = row[2];
                }
                for (var i = 0; i < rows.length; i++) {
                    var row = rows[i].split(',');
                    if (typeof (names[row[3]]) == 'undefined') names[row[3]] = row[2];
                    if (typeof (names[row[5]]) == 'undefined') names[row[5]] = row[2];
                }
                for (var i = 0; i < buses.length; i++) {
                    //배차없는차
                    if (!checked.includes(buses[i])) {
                        carindex[0].push(buses[i]);
                        cardata[buses[i]].schedule = { date: null, route: null, driver: null };
                    }
                }

                //렌더ㅡㅡㅡㅡ
                var output = '';
                var reducecss = ['', 'style="color: #CCC;"'];
                var toplinecss = 'style="margin-top: 0;"';
                for (var i = 0; i < group.length; i++) {
                    var prevroute = null;
                    group[i].forEach(route => {
                        if (prevroute != route) {
                            output += `
                                            <div id="line_${route}" class="article_line" ${toplinecss} onclick="gotoline('${route}');">
                                                ￭ ${route}번
                                            </div>
                                        `;
                            toplinecss = '';
                            prevroute = route;
                        }
                        carindex[route].forEach(car => {
                            output += `
                                            <div id="car_${car}" class="article" ${reducecss[cardata[car].schedule.reduce]} onclick="showdetail(${car})">
                                                <div class="number">${car}</div>
                                                <div class="detail">
                                                ${cardata[car].schedule.route}<br>${cardata[car].schedule.driver}
                                                </div>
                                            </div>
                                        `;
                        });
                    });
                }

                output += `
                                <div id="line_0" class="article_line" onclick="gotoline('0');">
                                    ￭ 배차없음
                                </div>
                            `;
                for (var i = 0; i < carindex[0].length; i++) {
                    var car = carindex[0][i];
                    output += `
                                    <div id="car_${car}" class="article" style="color: #CCC;" onclick="showdetail(${car})">
                                        <div class="number">${car}</div>
                                        <div class="detail">
                                        배차없음
                                        </div>
                                    </div>
                                `;
                }
                if(data.note != ''){
                    var note = data.note.trim();
                    note = note.replaceAll('*', '<br>*');
                    output+=`<div id="note" class="article"><div>${note}</div></div>`
                }
                $('#table').html(output);
                if (setting.autoSearch != null && $('#search').val() == '')
                    $('#search').val(setting.autoSearch).trigger('change');
                else if ($('#search').val() != '')
                    $('#search').trigger('change');
            },
            error: function (xhr) {
                console.log(xhr);
            }
        });
        var date = /(\d{4})년 (\d{1,2})월 (\d{1,2})일 \(([가-힣])\)/.exec(req);
        $('#date').html(`<span style="font-size:1rem">${date[3]}${date[4]}</span>`);
    }
}

function gotoline(line) {
    if (linelisted == 0) {
        $('.article').css('display', 'none');
        $('.article_line').addClass('article_line_big');
        $(`#line_${line}`)[0].scrollIntoView();
        linelisted = 1;
        return;
    }
    $('.article').css('display', 'block');
    $('.article_line').removeClass('article_line_big');
    $(`#line_${line}`)[0].scrollIntoView();
    linelisted = 0;
}

function trylogin() {
    event.preventDefault();
    var id = $('#loginform > #id').val();
    var pw = $('#loginform > #pw').val();
    $('#loginform > #submit').attr("disabled", true);
    $.ajax({
        url: api + '?q=login',
        type: 'POST',
        crossDomain: true,
        data: {
            id: id,
            pw: pw
        },
        dataType: 'json',
        success: function (result) {
            if (result.res == 200) {
                logined = true;
                document.cookie = `hash = ${result.b}; max-age=345600`;
                $('#login').css('display', 'none');
                schedules('new');
            }
            else if (result.res == 400) {
                $('#logincoment').html('<span style="color:#F00">ID, 비밀번호를 확인해주세요.</span>');
                $('#loginform > #submit').attr("disabled", false);
            }
            else if (result.res == 500)
                $('#logincoment').html('<span style="color:#F00">서버측 오류</span>');

        },
        error: function (xhr, status, error) {
            alert('오류: ' + status);
            console.log(xhr);
        }
    });
}

function openSetting() {
    $('#setting').css('display', 'block');
    $('#blur').css('display', 'block');
}

function showScheduleLog(date) {
    $('#dateselector').css('display', 'none');
    $('#blur').css('display', 'none');
    scheduleLogMode = true;

    const today = new Date();
    if (!date) date = [today.getFullYear(), today.getMonth() + 1];
    const thisDate = date;

    var prevDate, nextDate;
    if (thisDate[1] > 1) prevDate = [thisDate[0], thisDate[1] - 1];
    else prevDate = [thisDate[0] - 1, 12];
    if (thisDate[1] < 12) nextDate = [thisDate[0], thisDate[1] + 1];
    else nextDate = [thisDate[0] + 1, 1];

    $('#table').html(`
                    <div id="monthHeader">
                        <div class="monthSelector" onclick="showScheduleLog([${prevDate[0]}, ${prevDate[1]}])">←</div>
                        <div style="width: calc(10rem - 4px); line-height: 2.4em;">${thisDate[0]}년 ${thisDate[1]}월</div>
                        <div class="monthSelector" onclick="showScheduleLog([${nextDate[0]}, ${nextDate[1]}])">→</div></div>
                    <div id="monthTable">데이터 처리중</div>`
    );

    $.ajax({
        url: api + `?q=getTableMany&search=${thisDate[0]}년%20${thisDate[1]}월`,
        dataType: 'jsonp',
        jsonpCallback: "callback",
        success: function (data) {
            var list = [];
            var checked = [];
            var rawData = [];
            for (var i = 0; i < data.length; i++) {
                var date = /(\d{4})년 (\d{1,2})월 (\d{1,2})일 \(([가-힣])\)/.exec(data[i][0]);
                var unixdate = (new Date(date[1], date[2] - 1, date[3])).getTime();
                if (checked.includes(unixdate)) continue;

                checked.push(unixdate);
                list.push(data[i][0]);
                rawData[data[i][0]] = data[i][1].trim();
            }
            if (list.length == 0) {
                $('#monthTable').html(`배차 자료가 없습니다.`);
                return;
            }
            list.sort(function (a, b) {
                var aVal = /(\d{4})년 (\d{1,2})월 (\d{1,2})일 \(([가-힣])\)/.exec(a);
                aVal = new Date(aVal[1], aVal[2] - 1, aVal[3]).getTime();
                var bVal = /(\d{4})년 (\d{1,2})월 (\d{1,2})일 \(([가-힣])\)/.exec(b);
                bVal = new Date(bVal[1], bVal[2] - 1, bVal[3]).getTime();
                return aVal - bVal;
            });

            scheduleLogData = {
                cars: [],
                names: [],
                data: {}
            };
            var dayList = {};
            for (var i = 0; i < list.length; i++) {
                const rows = rawData[list[i]].split('\n');
                const date = /(\d{4})년 (\d{1,2})월 (\d{1,2})일 \(([가-힣])\)/.exec(list[i])[3] * 1
                dayList[date] = {};
                for (var j = 0; j < rows.length; j++) {
                    const row = rows[j].split(',');
                    if (row[7] == '1') continue;
                    dayList[date][row[2]] = {
                        route: row[0],
                        number: row[1],
                        spare1: false,
                        spare2: false
                    };
                    if (row[4] == '') dayList[date][row[2]].driver1 = row[3];
                    else {
                        dayList[date][row[2]].driver1 = row[4];
                        dayList[date][row[2]].spare1 = true;
                    }
                    if (row[6] == '') dayList[date][row[2]].driver2 = row[5];
                    else {
                        dayList[date][row[2]].driver2 = row[6];
                        dayList[date][row[2]].spare2 = true;
                    }
                    if (row[4] != '' || row[6] != '') dayList[date][row[2]].spare = true;

                    if (!scheduleLogData.cars.includes(row[2])) scheduleLogData.cars.push(row[2]);
                    if (!scheduleLogData.names.includes(dayList[date][row[2]].driver1)) scheduleLogData.names.push(dayList[date][row[2]].driver1);
                    if (!scheduleLogData.names.includes(dayList[date][row[2]].driver2)) scheduleLogData.names.push(dayList[date][row[2]].driver2);
                }
            }
            scheduleLogData.data = dayList;

            var output = '<div id="monthCalendar">';
            var cells = 0;
            const days = ['일', '월', '화', '수', '목', '금', '토'];
            const firstDay = new Date(thisDate[0], thisDate[1]-1, 1);
            const lastDate = new Date(thisDate[0], thisDate[1], 0);
            for (var i = 0; i < firstDay.getDay(); i++) {
                var addStyle = '';
                addStyle += `left: ${100 / 7 * i}%;`;

                output += `<div style="${addStyle}"></div>`;
                cells++;
            }
            for (var i = 0; i < lastDate.getDate(); i++) {
                const date = new Date(thisDate[0], thisDate[1]-1, i+1);

                var addStyle = '';
                if (date.getDate() + 7 > lastDate.getDate() + (6 - lastDate.getDay()))
                    addStyle += 'border-bottom: 1px solid #FFFFFF00;';

                addStyle += `left: ${100 / 7 * date.getDay()}%;`;
                addStyle += `top: ${Math.floor((cells) / 7) * 5}em;`;

                output += `<div style="${addStyle}";>
                                <div style="text-align: right;">${date.getDate()}&nbsp;</div>
                                <div id="monthCell_${date.getDate()}" class="monthCell"></div>
                            </div>`;
                cells++;
            }
            output += '</div><br><span id="monthComent"></span>';
            $('#monthTable').html(output);
            $('#monthCalendar').css('height', `${Math.ceil(cells / 7) * 5}em`);

            searchScheduleLog(false);
        },
        error: function (xhr) {
            console.log(xhr);
            $('#monthTable').html('데이터 로드 실패');
        }
    });
}

function searchScheduleLog(value = '') {
    if (setting.autoSearch != null && $('#search').val() == '' && value == false)
        $('#search').val(setting.autoSearch).trigger('change');

    if (value == '') {
        value = prevInput;
        //value = $('#search').val();
    }
    if (value == '') {
        $('#monthComent').text('"찾기"란에 운전자나 차량번호를 입력해주세요.');
        return;
    }

    var output = [];
    var count = [0, 0];
    if (isNaN(value)) {
        if (!scheduleLogData.names.includes(value)) return;
        const days = Object.keys(scheduleLogData.data);
        for (var i = 0; i < days.length; i++) {
            const cars = Object.keys(scheduleLogData.data[days[i]]);
            var workType = null;
            var row;
            for (var j = 0; j < cars.length; j++) {
                row = scheduleLogData.data[days[i]][cars[j]];
                if (row.driver1 != value && row.driver2 != value) continue;
                if (row.driver1 == value){
                    workType = 0;
                    break;
                }
                else{
                    workType = 1;
                    break;
                }
            }
            if(workType != null){
                output.push({
                    date: days[i],
                    route: row.route,
                    number: row.number,
                    car: cars[j],
                    type: workType
                });
            }
            else{
                output.push({
                    date: days[i],
                    type: null
                });
            }
        }
    }
    else {
        if (!scheduleLogData.cars.includes(value)) return;
        const days = Object.keys(scheduleLogData.data);
        for (var i = 0; i < days.length; i++) {
            const cars = Object.keys(scheduleLogData.data[days[i]]);
            if (!cars.includes(value)) continue;
            const row = scheduleLogData.data[days[i]][value];
            if (row.route == '831834') row.route = '831';
            output.push({
                date: days[i],
                route: row.route,
                number: row.number,
                driver1: row.driver1,
                driver2: row.driver2,
                spare1: row.spare1,
                spare2: row.spare2,
                type: 3
            });
        }
    }

    if (output.length == 0) {
        $('#monthComent').text('해당 검색어로 조회된 결과 없음');
        return;
    }

    $('.monthCell').html('');
    for (var i = 0; i < output.length; i++) {
        $(`#monthCell_${output[i].date}`).attr('style', '');
        if(output[i].type == null){
            $(`#monthCell_${output[i].date}`).css({
                'height': '3.5em',
                'background': 'linear-gradient(-45deg, transparent calc(50% - 0.5px), #CCC calc(50% - 0.5px), #CCC calc(50% + 0.5px), transparent calc(50% + 0.5px))'
            });
        }
        else if(output[i].type != 3){
            $(`#monthCell_${output[i].date}`).html(`${output[i].route}<br>${output[i].number}번<br>${output[i].car}`);
            const color = [['#FFE056', '#000'], ['#1B2C77', '#FFF']];
            $(`#monthCell_${output[i].date}`).css({
                'background-color': color[output[i].type][0],
                'color': color[output[i].type][1]
            });
            count[output[i].type]++;
        }
        else{
            $(`#monthCell_${output[i].date}`).html(`<span class="scale">${output[i].route} ${output[i].number}번</span><br><span class="driver1">${output[i].driver1}</span><br><span class="driver2">${output[i].driver2}</span>`);
            $(`#monthCell_${output[i].date} > .scale`).css({
                'transform': 'scaleX(0.7)',
                'transform-origin': 'left',
                'display': 'inline-block',
                'white-space': 'nowrap'
            });
            if (output[i].spare1)
                $(`#monthCell_${output[i].date} > .driver1`).css('background-color', '#FFE056');
            if (output[i].spare2)
                $(`#monthCell_${output[i].date} > .driver2`).css('background-color', '#FFE056');

        }
    }
    console.log(output);

    if (isNaN(value)) $('#monthComent').text(`오전 ${count[0]}일 + 오후 ${count[1]}일 = 합계 ${count[0] + count[1]}일 근무`);
    else $('#monthComent').text('');
}

function showdetail(car) {
    if (!logined) return;

    var driver = cardata[car].schedule.driver;
    if (driver != null) driver = driver.replaceAll('→', ' → ').split(' / ');
    else driver = [null, null];

    $('#busdetails').html(`
                <div id="number">
                    ${car}
                </div>
                <div class="description">
                    ${cardata[car].meta}<br>
                    주차자리: <span style="white-space: nowrap;">${cardata[car].parking}</span>
                </div>
                <div class="description">
                    ${cardata[car].schedule.date} 배차<br>
                    ${cardata[car].schedule.route}<br>
                    오전: ${driver[0]}<br>
                    오후: ${driver[1]}
                </div>
    `);

    $('#busdetails').css('display', 'block');
    $('#blur').css('display', 'block');
}

function cancelmodal() {
    $('#dateselector').css('display', 'none');
    $('#busdetails').css('display', 'none');
    $('#login').css('display', 'none');
    $('#setting').css('display', 'none');
    $('#blur').css('display', 'none');
}

$('#search').on('change keyup paste', function () {
    var input = $(this).val();
    console.log(input);

    if (isNaN(input)) {
        var input = $(this).val().toUpperCase();
        if (prevInput == input) return;

        if (scheduleLogMode) {
            searchScheduleLog(input);
            prevInput = input;
            return;
        }

        if (typeof (names[prevInput]) == 'string') $(`#car_${names[prevInput]}`).removeClass('highlight');

        prevInput = input;
        if (typeof (names[input]) == 'undefined') return;
        $(`#car_${names[input]}`)[0].scrollIntoView();
        $(`#car_${names[input]}`).addClass('highlight');
    }
    else {
        var input = ($(this).val() + '').padStart(4, "5000");
        if (prevInput == input) return;

        if (scheduleLogMode) {
            searchScheduleLog(input);
            prevInput = input;
            return;
        }

        if (buses.includes(prevInput)) $(`#car_${prevInput}`).removeClass('highlight');

        prevInput = input;
        if (!buses.includes(input)) return;
        $(`#car_${input}`)[0].scrollIntoView();
        $(`#car_${input}`).addClass('highlight');
    }
});

function tryHashLogin() {
    var hash = getCookie('hash');
    if (hash == null) return;

    $.ajax({
        url: api + '?q=login',
        type: 'POST',
        crossDomain: true,
        data: {
            hash: hash
        },
        dataType: 'json',
        success: function (result) {
            if (result.res == 200) {
                logined = true;
                document.cookie = `hash = ${result.b}; max-age=604800`;
                schedules('new');
            }
        }
    });


    function getCookie(name) {
        const cookies = document.cookie.split('; ');
        for (const cookie of cookies) {
            const [key, value] = cookie.split('=');
            if (key === name) return decodeURIComponent(value);
        }
        return null;
    }
}

async function editSetting(type, key) {
    var keys = Object.keys(setting);

    if (type == 'read') {
        for (var i = 0; i < keys.length; i++) {
            var value = localStorage.getItem(keys[i]);
            if (value == null || keys == 'receivePush') continue;
            if (['true', 'false', 'null'].includes(value)) value = JSON.parse(value);
            setting[keys[i]] = value;
        }
        //setting.receivePush = await checkSubscription();

        var values = { true: '☑', false: '☐' };
        $('#setting_autoLogin').html(values[setting.autoLogin]);

        var values = { true: '☑', false: '☐' };
        $('#setting_receivePush').html(values[setting.receivePush]);

        var values = setting.autoSearch || '';
        $('#setting_autoSearch').html(`✎${values}`);

        if (!setting.autoLogin) document.cookie = `hash = ; max-age=0`;
    }
    else if (type == 'click') {
        if (key == 'autoLogin') {
            if (setting.autoLogin == true) setting.autoLogin = false;
            else setting.autoLogin = true;
        }
        else if (key == 'autoSearch') {
            var value = window.prompt('입력 예시: 홍길동(이름), 47, 5047(차량번호)');
            if (value == '') value = null;
            setting.autoSearch = value;
        }
        else if (key == 'receivePush') {
            if(setting.receivePush){
                if(await unsubscribeUser())
                    setting.receivePush = false;
            }
            else{
                if(await subscribeUser())
                    setting.receivePush = true;
            }
        }

        editSetting('write');
    }
    else if (type == 'write') {
        for (var i = 0; i < keys.length; i++) {
            localStorage.setItem(keys[i], setting[keys[i]]);
        }
        editSetting('read');
    }
}

document.addEventListener("DOMContentLoaded", () => {
    editSetting('read');
    listBuses();
    $('#footer').text(`- 차량정보 기준일자: ${version} -`);
});

//푸시관련
const VAPID_PUBLIC_KEY = 'BKFxAExxrSCp3Uf7CcQOJNMvL3D82ZK6Hr01kFIfPC8srQ8JE_nRnWUz_2T3gQTpffpOOupMSc-jt3r6ns02VsU';

async function registerServiceWorker() {
    return await navigator.serviceWorker.register('./sw.js');
}

async function subscribeUser() {
    const reg = await registerServiceWorker();
    const permission = await Notification.requestPermission();
    if (permission !== 'granted'){
        alert('알림 권한을 허용해야 합니다.');
        return false;
    }

    const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
    });

    const subs = JSON.parse(JSON.stringify(sub));
    const form = new FormData();
    form.append('endpoint', subs.endpoint);
    form.append('p256dh', subs.keys.p256dh);
    form.append('auth', subs.keys.auth);

    const res = await fetch(`${api}?q=push&t=sub`, {
        method: 'POST',
        body: form
    });
    console.log(res);
    return true;
}

async function unsubscribeUser() {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    const subs = JSON.parse(JSON.stringify(sub));

    const form = new FormData();
    form.append('endpoint', subs.endpoint);

    if (sub) {
        await sub.unsubscribe();
        const res = await fetch(`${api}?q=push&t=unsub`, {
            method: 'POST',
            body: form
        });
        console.log(res);
        return true;
    }
}

async function checkSubscription() {
    if (!('serviceWorker' in navigator)) {
        console.warn('서비스워커 미지원 브라우저입니다.');
        return false;
    }

    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();

    if (sub) {
        console.log('구독 중:', sub.endpoint);
        return true;
    }
    else {
        console.log('구독상태 아님');
        return false;
    }
}


function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

registerServiceWorker();