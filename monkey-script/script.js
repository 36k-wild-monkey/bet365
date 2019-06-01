
// ==UserScript==
// @name         明升-篮球脚本
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  try to take over the world!
// @author       You
// @match        *://sports.imkra.com/*
// @grant        none
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';
    function add_script(src) {
        var script = document.createElement('script');
        script.src = src + '?t=' + new Date().getTime();
        document.body.appendChild(script);
    }
    var ui_html = `
    <style>
        #drag-win {
            z-index: 99999;
            width: 450px;
            padding: 5px;
            border: 15px solid #b55050;
            border-radius: 5px;
            background-color: #fff;
            max-height: 450px;
            overflow: hidden;
            overflow-y: auto;
        }
        #drag-win * {
            padding: 0;
            margin: 0;
        }

        #drag-win input {
            margin: 5px 10px;
        }
        
        #drag-win ul, #drag-win li {
            list-style: none;
        }

        #drag-win li {
            display: block;
        }

        #drag-win #refresh {
            width: 80px;
        }
        #comp-list {
            padding: 10px 0;
        }
        #status-tip {
            color: red;
        }

    </style>

    <div>
        <div>
            状态提示: <span id="status-tip"></span><br>
            当前比赛名: <span id="comp-name"></span><br>
            当前比赛id: <span id="marketlineid"></span>
        </div>
        <div>
            <input type="checkbox" id="score-1">罚球得分
            <input type="checkbox" id="score-2" checked>2分球
            <input type="checkbox" id="score-3" checked>3分球
        </div>
        <div>
            <input type="radio" id="any-select" name="team-select" checked>两边都买
        </div>
        <div>
            <input type="radio" id="home-select" name="team-select">主队：<input type="text" id="home-down-money" value="10"><input type="button" value="测试" id="home-test">
        </div>
        <div>
            <input type="radio" id="away-select" name="team-select">客队：<input type="text" id="away-down-money" value="10"><input type="button" value="测试" id="away-test">
        </div>

        <div>
            <input type="checkbox" id="on-bet">开启下注挂机<br>
            <input type="checkbox" id="on-bet-invert">反转队伍(注意测试)
        </div>
        <input id="refresh" type="button" value="刷新">
        <ul id="comp-list"></ul>

    </div>
   `;
        (function(){
            var bet_status = false;
            var bet_invert = false;
            var bet_select_team = -1;  // -1 两边都买   0 买主队  1 买客队
            var bet_team;

            function DragFrame(_frame){
                var _frame_move = false;
                var _frame_x = 0;
                var _frame_y = 0;

                _frame.style.display = 'block';
                _frame.style.position = 'absolute';

                _frame.addEventListener('mousedown', function(event){
                    var x = event.pageX || event.clientX + document.body.scroolLeft;
                    var y = event.pageY || event.clientY + document.body.scrollTop;
                    if(document.elementFromPoint(x,y) == this) {
                        _frame_move = true;
                        _frame_x = event.offsetX;
                        _frame_y = event.offsetY;
                    } else {
                        _frame_move = false;
                    }
                });

                document.addEventListener('mousemove', function(event){
                    if(_frame_move) {
                        var x = event.pageX || event.clientX + document.body.scroolLeft;
                        var y = event.pageY || event.clientY + document.body.scrollTop;
                        _frame.style.left = x - _frame_x - 10 + 'px';
                        _frame.style.top = y - _frame_y - 10 + 'px';
                    }
                });
                document.addEventListener('mouseup', function(event){
                    _frame_move = false;
                });
            }

            function refresh() {
                var list_frame = document.querySelector('#comp-list');
                list_frame.innerHTML = ``;

                var index = 0;

                var teams = document.querySelectorAll('[leagueid] > [matchid]');
                for(var i=0; i<teams.length; i++){
                    // 赛事节点
                    var nodes = teams[i].querySelectorAll('div[handicapfav].OddsLineDiv');

                    for(var n=0; n<nodes.length; n++){
                        var name = nodes[0].querySelector('.teamInfo').innerText;

                        var bet_btn = nodes[n].querySelector('span[wagerselectionid]');
                        var line = bet_btn.parentElement.parentElement;
                        var ol = line.getAttribute('ol');
                        var hdp = line.getAttribute('hdp');
                        var marketlineid = line.getAttribute('marketlineid');


                        var li = document.createElement('li');
                        li.id = 'comp_' + index;
                        li.innerHTML = `<input type="radio" name="select" data-marketlineid="` + marketlineid + `" data-comp-name="` + name + `"><span>` + name + `</span>`;

                        list_frame.appendChild(li);
                        index += 1;

                        document.querySelector('#' + li.id +' input[type="radio"][name="select"]').onclick = function(){
                            var selectid = this.getAttribute('data-marketlineid');
                            var name = this.getAttribute('data-comp-name');
                            document.querySelector('#marketlineid').innerText = selectid;
                            document.querySelector('#comp-name').innerText = name.trim().replace('\n', ' VS ');
                        }
                    }
                }
            }
            function log(t){
                var m = '自动下注脚本: ' + t;
                document.querySelector('#status-tip').innerText = m;
                console.log(m);
            }
            function msgbox(t) {
                alert('自动下注脚本: ' + t);
            }

            function down_bet(money=5, is_click=true) {
                var i = 0;
                var timer = setInterval(function(){
                    i += 1;
                    if(i > 10) {
                        clearInterval(timer);
                        log('找不到, 确认下注按钮');
                        return
                    }

                    try{
                        document.querySelector('#betPlaceStakeTextbox').value = money;
                        if(is_click) {
                            // 点击确定下注
                            document.querySelector('#betPlacePlaceBetButton').click();
                            // 再次下注确认
                            document.querySelector('.ui-dialog-buttonset button').click()
                            // 投注成功确认
                            document.querySelector('.ui-dialog-buttonset button').click()
                            log('购买: ' + bet_team == 'Home_AH' ? '主队' : '客队' + '  下注成功' + money + '元');
                        }
                        
                    } catch(e) {
                        log('购买: ' + bet_team == 'Home_AH' ? '主队' : '客队' + '  确认下注失败');
                    }
                    clearInterval(timer);

                }, 200);
            }

            function start_ws(){
                var timer;
                var ws = new WebSocket('ws://localhost:8887/ball');
                function hear(){
                    ws.send(JSON.stringify({action: 'auth', type: 'bet'}));
                    ws.send(JSON.stringify({action: 'hear', time: new Date().getTime()}));
                }
                ws.onopen = function(){
                    log('ws连接成功');
                    ws.send(JSON.stringify({action: 'auth', type: 'bet'}));
                    timer = setInterval(hear, 10000);
                }
                ws.onclose = function(){
                    clearInterval(timer);
                    msgbox('ws断开连接');
                }
                ws.onmessage = function(event) {
                    var data = JSON.parse(event.data);
                    if(data.action == 'update') {
                        if(!bet_status) {
                            log('下注停用');
                            return;
                        }

                        if(data.team.trim().indexOf(data.home_name.trim()) > -1) {
                            bet_team = 'Home_AH';
                            if(bet_invert) {
                                bet_team = 'Away_AH';
                            } 
                        } else {
                            bet_team = 'Away_AH';
                            if(bet_invert) {
                                bet_team = 'Home_AH';
                            } 
                        }
                        // console.log(data.team.trim().indexOf(data.home_name.trim()), data.team.trim(), data.home_name.trim(), bet_team)

                        if(bet_select_team == -1) {

                        } else if(bet_select_team == 0 && bet_team == 'Home_AH') { // 只买主队

                        }  else if(bet_select_team == 1 && bet_team == 'Away_AH') { // 只买客队

                        } else {
                            log('下注队伍不符合:' + bet_team == 'Home_AH' ? '主队' : '客队');
                            return;
                        }

                        if (['罚球得分', '2分球', '3分球'].indexOf(data.type) < 0) {
                            return;
                        } 
                        if (data.type == '罚球得分' && document.querySelector('#score-1').checked == false) {
                            log('罚球得分不买:' + (bet_team == 'Home_AH' ? '主队' : '客队'));
                            return;
                        }
                        if (data.type == '2分球' && document.querySelector('#score-2').checked == false) {
                            log('2分不买:' + (bet_team == 'Home_AH' ? '主队' : '客队'));
                            return;
                        }
                        if (data.type == '3分球' && document.querySelector('#score-3').checked == false) {
                            log('3分球不买:' + (bet_team == 'Home_AH' ? '主队' : '客队'));
                            return;
                        }

                        var marketlineid = document.querySelector('#marketlineid').innerText.trim();
                        var bet_btn = document.querySelector('[marketlineid="' + marketlineid + '"] [selection="' + bet_team + '"]');
                        if(!bet_btn){
                            log('找不到下注按钮');
                            return;
                        }

                        bet_btn.click();

                        // log('购买: ' + bet_team == 'Home_AH' ? '主队' : '客队' )
                        // 确认下注
                        var bet_money = 0;
                        if (bet_team == 'Home_AH') {
                            bet_money = document.querySelector('#home-down-money').value
                        } else {
                            bet_money = document.querySelector('#away-down-money').value
                        }
                        down_bet(bet_money, true);

                        
                    }
                }

            }
            function main(){
                var div = document.createElement('div');
                div.id = 'drag-win';
                div.innerHTML = ui_html;
                document.body.appendChild(div);

                document.addEventListener('keyup', function(event){
                    
                    if(event.keyCode == 37) { // 左光标键盘
                        document.querySelector('#home-select').click();
                    } else if (event.keyCode == 39) { // 右光标键盘
                        document.querySelector('#away-select').click();
                    } else if (event.keyCode == 38) { // 上光标键盘
                        document.querySelector('#any-select').click();
                    }

                });

                document.querySelector('#home-test').onclick = function(){
                    var marketlineid = document.querySelector('#marketlineid').innerText.trim();
                    var bet_btn;
                    if(bet_invert) {
                        bet_btn = document.querySelector('[marketlineid="' + marketlineid + '"] [selection="Away_AH"]');
                    } else {
                        bet_btn = document.querySelector('[marketlineid="' + marketlineid + '"] [selection="Home_AH"]');
                    }
                    if(!bet_btn){
                        log('找不到下注按钮');
                        return;
                    }
                    bet_btn.click();
                    var bet_money = 0;
                    bet_money = document.querySelector('#home-down-money').value
                    down_bet(bet_money, false);
                };

                document.querySelector('#away-test').onclick = function(){
                    var marketlineid = document.querySelector('#marketlineid').innerText.trim();
                    var bet_btn;
                    if(bet_invert) {
                        bet_btn = document.querySelector('[marketlineid="' + marketlineid + '"] [selection="Home_AH"]');
                    } else {
                        bet_btn = document.querySelector('[marketlineid="' + marketlineid + '"] [selection="Away_AH"]');
                    }
                     
                    if(!bet_btn){
                        log('找不到下注按钮');
                        return;
                    }
                    bet_btn.click();

                    var bet_money = 0;
                    bet_money = document.querySelector('#away-down-money').value
                    down_bet(bet_money, false);
                };

                DragFrame(document.querySelector('#drag-win'));

                document.querySelector('#refresh').onclick = refresh;
                document.querySelector('#on-bet').onclick = function(){
                    if(this.checked) {
                        bet_status = true;
                    } else {
                        bet_status = false;
                    }
                };
                document.querySelector('#on-bet-invert').onclick = function(){
                    if(this.checked) {
                        bet_invert = true;
                    } else {
                        bet_invert = false;
                    }
                };

                document.querySelector('#home-select').onclick = function(){
                    bet_select_team = 0;
                }
                document.querySelector('#away-select').onclick = function(){
                    bet_select_team = 1;
                }
                document.querySelector('#any-select').onclick = function(){
                    bet_select_team = -1;
                }

                start_ws();
            }

            main();

        
    })();


})();