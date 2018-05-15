window.gameFunctions = window.gameFunctions || {};

window.gameFunctions.gameSendMessage = function(messageCode, messageData){
	if(!window.gameVars)
		return;
	if(messageCode == 13)
		window.gameVars.Game.LastTimeDropItem = window.performance.now();
}

window.gameFunctions.gameSrocessGameUpdate = function(mesg){
	
	var red = { r: 255, g: 0, b: 0 };
	var green = { r: 0, g: 180, b: 0 };
	
	function getColor(color1, color2, weight) {
		var w1 = weight;
		var w2 = 1 - w1;
		var rgb = {
			r: Math.round(color1.r * w1 + color2.r * w2),
			g: Math.round(color1.g * w1 + color2.g * w2),
			b: Math.round(color1.b * w1 + color2.b * w2)
		};
		return rgb;
	}
	
	function getWeight(value, min, max) {
		if (value <= min) return 0;
		if (value >= max) return 1;
		return (value - min) / (max - min);
	}
	
	function colorToString(color) {
		return 'rgba(' + color.r + ', ' + color.g + ', ' + color.b + ', 1.0)';
	}
	
	function getMean(array) {
		return array.reduce((acc, val) => acc + val) / array.length;
	}
	
	// update LAT counter
	
	var perf = window.gameVars.Perfomance;
	var LATinertia = 0.1;
	var LATResultsCount = 15;
	
	
	var time = (new Date).getTime();
	if (mesg.ack == this.seq && this.seqInFlight) {
		this.seqInFlight = false;
		var ping = time - this.seqSendTime;
		this.pings.push(ping);
	}
	
	while (this.pings.length > LATResultsCount) {
		this.pings.shift();
	}
	
	var LAT = getMean(this.pings);
	
	if(perf.lastLAT) {
		LAT = LAT * (1 - LATinertia) + perf.lastLAT * LATinertia;
	}

	perf.lastLAT = LAT;
		
	var LATCol = getColor(red, green, getWeight(LAT, 10, 200));
	
	window.gameVars.UI.LATText.text("LAT: " + Math.round(LAT));
	window.gameVars.UI.LATText.css('color', colorToString(LATCol));
}
	
window.gameFunctions.gameUpdate = function(){
	
	if(!window.menu || !window.menu.UserSetting)
		return;
	
	// Local functions
	
	var getDistance = function(p1, p2) {
		var dx = p2.x - p1.x, dy = p2.y - p1.y;
		return Math.sqrt( dx*dx + dy*dy );
	};

	var getSecondsElapsed = function(time) {
		return (window.performance.now() - time) / 1000;
	};

	var getTimeElapsed = function(time) {
		return (window.performance.now() - time);
	};
	
	var detectEnimies = function() {
		if(!game.playerBarn.playerInfo[game.activeId]) return [];
		var selfId = game.activeId;
		var selfTeamId = game.playerBarn.playerInfo[game.activeId].teamId;
		var objectIds = Object.keys(game.objectCreator.idToObj);
		var playerIds = Object.keys(game.playerBarn.playerInfo);

		return playerIds
			.filter(function(id) {
				var playerObject = game.objectCreator.idToObj[id];
				return playerObject && 
				(!playerObject.netData.dead) && 
				(!playerObject.netData.downed) &&
				game.playerBarn.playerInfo[id].teamId != selfTeamId &&
				id != selfId;})
			.map(function(id) {
				return game.objectCreator.idToObj[id];
		});
	}
	
	var processPlayerSpeed = function(player, inertia) {
		if(!player)
			return;
		
		if(!player.lastTime || getSecondsElapsed(player.lastTime) > 0.19)
		{
			player.lastPos = player.pos;
			player.lastTime = window.performance.now();
			player.prediction = {x:0.0, y:0.0};
			player.speed = 0.0;
			player.distance = 0.0;
			player.direction = null;
			
			return;
		}
		
		var distance = getDistance(player.pos, player.lastPos);
		
		if(distance > 0.0001)
		{
			player.direction = {
					x: (player.pos.x - player.lastPos.x) / distance,
					y: (player.pos.y - player.lastPos.y) / distance
				}
		}
		else
		{
			player.direction = null;
		}
		
		var speed = distance / getSecondsElapsed(player.lastTime);
		
		if(player.speed)
			speed = (speed * (1.0 - inertia)) + (player.speed * inertia);
		
		
		player.speed = speed;
		player.distance = distance;
		player.lastTime = window.performance.now();
		player.lastPos = player.pos;
	};
	
	var processEnemy = function(enemy) {
		if(!enemy)
			return;
		
		processPlayerSpeed(enemy, window.menu.UserSetting.shoot.autoAimSpeedInertia);
		
		if(!curBullet)
		{
			enemy.range = 0.0;
			enemy.prediction = {x:0.0, y:0.0};
			return;
		}
		
		var bulletReachTime = getDistance(curPlayer.pos, enemy.pos) / curBullet.speed;
		
		var range = bulletReachTime * enemy.speed;
		
		var prediction = {
				x: 0,
				y: 0
			};
		
		if(enemy.direction)
		{
			prediction = {
				x: enemy.direction.x * range,
				y: enemy.direction.y * range
			}
		}
		
		var predInert = window.menu.UserSetting.shoot.autoAimPredictionInertia;
		
		prediction.x = prediction.x * (1.0 - predInert) + enemy.prediction.x * predInert;
		prediction.y = prediction.y * (1.0 - predInert) + enemy.prediction.y * predInert;
		
		enemy.prediction = prediction;
		enemy.range = range;
	};
	
	var runTimer = function (timerText, timerTime) {
		if(!game.pieTimer || (game.pieTimer.timerTimeout && getSecondsElapsed(game.pieTimer.timerTimeout) < 0.1))
			return;
		
		game.pieTimer.free();
		game.pieTimer.init(() => {stopTimer()}, timerTime, timerText, false);
	};

	var stopTimer = function() {
		if(!game.pieTimer)
			return;
		
		game.pieTimer.free();
		
		game.pieTimer.timerBackground.tint = 16777215;
		game.pieTimer.outerCircle.tint = 16777215;
		game.pieTimer.counterText.tint = 16777215;
		game.pieTimer.labelText.tint = 16777215;
		
		game.pieTimer.timerTimeout = performance.now();
	};
	
	var getLootRange = function(loot) {
		return getDistance(loot.pos, curPlayer.pos) - items[loot.name].rad - gameData.player.radius;
	}

	var needToLoot = function() {
		var loot = game.lootBarn.closestLoot;
		
		var gunsSafeDistance = window.menu.UserSetting.loot.autolootSafeDistance;
		
		if(!loot)
			return false;
		
		var needGuns = !invWeapon1 || !invWeapon2;
		
		var gunsNearBy = game.lootBarn.lootPool.pool.filter((l) => l.active && getLootRange(l) < gunsSafeDistance && gunNames.includes(l.name));
		
		var isSafeToPickup = !gunNames.includes(curPlayer.weapType);
		
		var lootIsDual = 
			(invWeapon1 && invWeapon1.dualWieldType && invWeapon1.id == loot.name) || 
			(invWeapon2 && invWeapon2.dualWieldType && invWeapon2.id == loot.name);
		
		
		var dualOnlyInRange = gunsNearBy.every((g) =>
			(invWeapon1 && invWeapon1.dualWieldType && invWeapon1.id == g.name) || 
			(invWeapon2 && invWeapon2.dualWieldType && invWeapon2.id == g.name));
		
		if(!isSafeToPickup && !needGuns && gunsNearBy.length > 0 && !dualOnlyInRange)
			return;
		
		if(gunNames.includes(loot.name)) {
			if(needGuns || lootIsDual)
				return true;
		}		
		
		else if(loot.name.includes('backpack') && loot.name > game.activePlayer.netData.backpack) return true;
		else if(loot.name.includes('chest') && loot.name > game.activePlayer.netData.chest) return true;
		else if(loot.name.includes('helmet') && loot.name > game.activePlayer.netData.helmet) return true;
		else if(game.activePlayer.localData.inventory.hasOwnProperty(loot.name)){
				
			var backpackLvls = parseInt(game.activePlayer.netData.backpack.match(/\d/g).join(""));
				
			var max = gameData.bagSizes[loot.name][backpackLvls];
			var cur = game.activePlayer.localData.inventory[loot.name];
				
			if(cur < max)
				return true;
		}
		
		return false;
	};
	
	// Local variables
	
	var game = this;
	
	if(!window.gameVars)
		return;
	
	var state = window.gameVars.Game;
	var gameData = state.GameData;
	
	if(!gameData)
		return;
	
	var items = gameData.items;
	var mapScale = 16.25;
	
	var autoFireGuns =  ["fists", "mk12", "m39", "saiga", "m9", "m9_dual", "ot38", "ot38_dual"];
	var grenadeTimerWarning = 1.05;
	
	var guns = [];
	var gunNames = [];
	for (var itm in items){
		var itmType = items[itm].type;
		if(itmType == "gun")
		{
			items[itm].id = itm;
			guns.push(items[itm])
			gunNames.push(itm)
		}
	}
	
	var curPlayer = game.activePlayer;

	if(!curPlayer)
		return;
	
	var curWeapon = null;
	for(var k in gameData.items){
		if (k.toString().includes(curPlayer.weapType))
			curWeapon = gameData.items[k];
	}
	
	var curBullet = null;
	if(curWeapon)
		for(var k in gameData.bullets){
			if (k.toString().includes(curWeapon.bulletType))
			{
				curBullet = gameData.bullets[k];
			}
		}
	
	var invWeapon1Name = curPlayer.localData.weapons["0"].name;
	var invWeapon2Name = curPlayer.localData.weapons["1"].name;
	
	var invWeapon1 = invWeapon1Name == "" ? null : guns.find((g) => g.id == invWeapon1Name);
	var invWeapon2 = invWeapon2Name == "" ? null : guns.find((g) => g.id == invWeapon2Name);
	
	processPlayerSpeed(curPlayer, 0.1);
	
	curPlayer.moving = curPlayer.speed > 0.01;
	
	// Laser
	
	var laser = state.Laser;
	
	if(curBullet)
	{
		laser.active = true;
		laser.range = curBullet.distance * mapScale;
		laser.direction = Math.atan2(curPlayer.netData.dir.x, curPlayer.netData.dir.y) - Math.PI / 2;
		laser.angle = (curWeapon.shotSpread + (curPlayer.moving ? curWeapon.moveSpread : 0.0)) * 0.01745329252 / 2;
	}
	else
	{
		laser.active = false;
	}
	
	// Zoom

	var currentZoom = window.gameVars.ZoomLevel;
	
	currentZoom *= 1.0 + window.menu.UserSetting.look.zoomSpeed / 50 * window.gameVars.Input.Wheel.GetDelta();
	currentZoom = currentZoom < 0.1 ? 0.1 : currentZoom > 1.0 ? 1.0 : currentZoom;
	
	if(!window.gameVars.Menu && window.menu.UserSetting.look.zoomEnabled)
		window.gameVars.ZoomLevel = currentZoom;
	
	// Detect enimies
	
	var enimies = detectEnimies();
	
	enimies.forEach(processEnemy);
	
	window.gameVars.Game.Enimies = enimies;
	
	// Update enemy lines
	
	window.gameVars.Game.EnemyLines.points = enimies.map((enemy) => {
		return {
			x: (enemy.pos.x - curPlayer.pos.x) * mapScale,
			y: (curPlayer.pos.y - enemy.pos.y) * mapScale
		};
	});
	
	// Update autoaim
	
	var target = null;
	
	if(window.menu.UserSetting.shoot.autoAimEnabled && window.gameVars.Input.Mouse.RightMouseButton && enimies.length != 0)
	{
		var mousePos = game.camera.screenToPoint(window.gameVars.Input.Mouse.Pos);

		var mouseVec =
		{
			x: mousePos.x - curPlayer.pos.x,
			y: mousePos.y - curPlayer.pos.y
		};
		
		var enemiesInSight = enimies.filter((enemy) =>
			{
				var enemyDir =
				{
					x: enemy.pos.x - curPlayer.pos.x,
					y: enemy.pos.y - curPlayer.pos.y
				};
				
				var enemyDistance = getDistance(enemy.pos, curPlayer.pos);
				
				var angleDif = Math.abs(Math.atan2(enemyDir.y, enemyDir.x) - Math.atan2(mouseVec.y, mouseVec.x));
				
				return angleDif < window.menu.UserSetting.shoot.autoAimRestirctionAngle * 0.0174533 || enemyDistance <  window.menu.UserSetting.shoot.autoAimRestrictionCloseRange;
			});
		
		if(enemiesInSight.length > 0)
			target = enemiesInSight
				.reduce((e1, e2) => (getDistance(mousePos, e1.pos) < getDistance(mousePos, e2.pos)) ? e1 : e2);
	}
	
	window.gameVars.Game.Target = target;
	
	(function() {
		if(!target)
		{
			window.gameVars.Input.Mouse.AimActive = false;
			return;
		}
		
		var pos = target.pos;
		var prediction = target.prediction ? target.prediction : {x:0, y:0};
		
		window.gameVars.Input.Mouse.AimActive = true;
		window.gameVars.Input.Mouse.AimPos = game.camera.pointToScreen({x: pos.x + prediction.x, y: pos.y + prediction.y});
	})();
	
	// Grenade timer
	
	if(window.menu.UserSetting.shoot.fragGrenadeTimerEnabled && !game.pieTimer.active &&	curPlayer.weapType == "frag" && game.input.mouseButton)
		runTimer("GRENADE", 4.0);
	
	if(game.pieTimer.active  && game.pieTimer.clientData.label == "GRENADE")
	{
		if(!game.input.mouseButton)
		{
			stopTimer();
			return;
		}
		
		if(game.pieTimer.clientData.duration - game.pieTimer.clientData.elapsed < grenadeTimerWarning)
		{
			game.pieTimer.timerBackground.tint = 0xff0000;
			game.pieTimer.outerCircle.tint = 0xff0000;
			game.pieTimer.counterText.tint = 0xff0000;
			game.pieTimer.labelText.tint = 0xff0000;
		}
	}
	
	// Bump fire
	
	window.gameVars.Input.Mouse.RepeatFire = !window.gameVars.Menu && window.menu.UserSetting.shoot.bumpFireEnabled && game.input.mouseButton && autoFireGuns.includes(curPlayer.weapType);
	
	// Auto loot
	
	window.gameVars.Input.Keyboard.RepeatInteraction = window.menu.UserSetting.loot.autolootEnabled && (getSecondsElapsed(state.LastTimeDropItem) > window.menu.UserSetting.loot.autolootDropDelay) && needToLoot();
}