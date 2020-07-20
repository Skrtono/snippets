// ==UserScript==
// @name         yunding2.0
// @namespace    http://tampermonkey.net/
// @version      1.1.1
// @description  helper js
// @author       叶天帝
// @match        *://yundingxx.com:3366/*
// @exclude      *://yundingxx.com:3366/login*
// @updateURL    https://cdn.jsdelivr.net/gh/whosphp/snippets/xx.user.js
// @downloadURL  https://cdn.jsdelivr.net/gh/whosphp/snippets/xx.user.js
// @grant        unsafeWindow
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_xmlhttpRequest
// @require      https://cdn.jsdelivr.net/npm/vue@2.6.11/dist/vue.min.js
// @require      https://cdn.jsdelivr.net/npm/element-ui@2.13.2/lib/index.js
// @require      https://cdn.jsdelivr.net/npm/later@1.2.0/later.min.js
// @require      https://cdn.jsdelivr.net/npm/lodash@4.17.15/lodash.min.js
// @run-at       document-start
// ==/UserScript==
unsafeWindow.who_user = null

let who_interval = setInterval(function () {
	'use strict'

	// 等待 pomelo 初始化 ws 链接
	if (typeof user_id === "undefined") {
		return
	} else {
		if (who_user === null) {
			pomelo.request("connector.userHandler.userInfo", {}, data => {
				if (data.code === 200) {
					unsafeWindow.who_user = data.user
					who_user.nextLevelGetExp = data.nextLevelGetExp
				}
			})

			return
		} else {
			clearInterval(who_interval)
		}
	}

	// 注入hooks
	let oldRequest = pomelo.request
	let routesToHook = [
		"connector.userHandler.getMyGoods",
	]
	pomelo.request = function(route, msg, cb) {
		let shouldLog = routesToHook.includes(route)

		let oldCb = cb
		cb = function(res) {
			shouldLog && log(res)
			oldCb(res)
		}

		oldRequest(route, msg, cb)
	}

	function getKey(key) {
		return who_user_id + ':' + key
	}

	setInterval(_ => {
		initPageUserInfo()
	}, 60000)

	let who_user_id = user_id

	if (typeof unsafeWindow.consolelog === "undefined") {
		var consolelog = false
	} else {
		var consolelog = unsafeWindow.consolelog
	}

	let roads, maps, mapsKeyByName

	// 下载地图
	GM_xmlhttpRequest({
		method: "GET",
		url: "https://cdn.jsdelivr.net/gh/whosphp/static/roads.json",
		responseType: "json",
		onload: function (response) {
			({roads, maps} = response.response)
			mapsKeyByName = _.keyBy(maps, 'name')
		}
	})

	// 寻路
	function getPath(from, to) {
		let path = []

		for (let i = 0; i < roads.length; ++i) {
			let road = roads[i]
			let fromIndex = road.indexOf(from)
			let toIndex = road.indexOf(to)

			if (fromIndex > -1 && toIndex > -1) {
				if (fromIndex <= toIndex) {
					path = road.slice(fromIndex, toIndex);
				} else {
					path = road.slice(toIndex, fromIndex).reverse()
				}

				return path
			}
		}

		for (let i = 0; i < roads.length; ++i) {
			let road = roads[i]
			let fromIndex = road.indexOf(from)

			if (fromIndex > -1) {
				path = path.concat(road.slice(0, fromIndex).reverse())
				break
			}
		}

		for (let i = 0; i < roads.length; ++i) {
			let road = roads[i]
			let toIndex = road.indexOf(to)

			if (toIndex > -1) {
				path = path.concat(road.slice(1, toIndex + 1))
				break
			}
		}

		return path
	}

	// 换图
	async function autoMove(path) {
		log(path)
		for (let i = 0; i < path.length; i++) {
			await sleep(100)
			let moveRes = await routeHandlers.moveToNewMap({mid: path[i]})
			log(moveRes)
			if (moveRes.code === 200) {
				global.mid = path[i]
			}
		}

		return true
	}

	console.log('start loading...')

	$('head').append(`<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/element-ui@2.13.2/lib/theme-chalk/index.css">`)
	$('head').append(`
<style>
	.el-table--mini table {
		font-size: 14px;
	}

	.el-card__header {
		padding: 5px;;
	}
</style>
`)

	// 顶端经验条
	$(`
<div style="
    border-top: 3px dotted burlywood;
    float: left;
    width: 100%;
    position: absolute;
    left: 0;
">
    
</div>
<div id="whoExpBar" style="
    width: 0;
    float: left;
    height: 3px;
    position: absolute;
    left: 0;
    background-color: green;
"></div>
		`).insertAfter('.top-bar')

	$('.pdf:first').append(`
<div id="whoapp">
	<el-row>
		<el-button size="mini" type="danger" @click="pageReload">刷新</el-button>
		<el-button size="mini" type="warning" @click="gracefulReload = true">平滑刷新</el-button>
	</el-row>
	<el-row>
		自动帮派
		<el-switch
			v-model="stores.autoFation"
		  	active-color="#13ce66"
		  	inactive-color="#ff4949">
		</el-switch>
		<el-button style="float: right; padding: 3px 0" type="text" @click="dialogAutoFationSettings = true">配置</el-button>
		<el-dialog title="自动帮派任务配置" :visible.sync="dialogAutoFationSettings" :modal="false" :append-to-body="true">
			<el-table :data="stores.allFationTasks" size="mini">
				<el-table-column property="info" label="名称"></el-table-column>
				<el-table-column label="需要">
					<template slot-scope="scope">
						{{ formatNeedGoods(scope.row) }}
					</template>
				</el-table-column>
				<el-table-column label="给予">
					<template slot-scope="scope">
						{{ formatGivenGoods(scope.row) }}
					</template>
				</el-table-column>
				<el-table-column>
					<template slot-scope="scope">
						<el-radio-group v-model="scope.row.who_action">
							<el-radio :label="1">必做</el-radio>
							<el-radio :label="2">有就做</el-radio>
							<el-radio :label="3">不做</el-radio>
						</el-radio-group>
					</template>
				</el-table-column>
			</el-table>
			<div slot="footer" class="dialog-footer">
				<el-button @click="dialogAutoFationSettings = false" size="mini">取消</el-button>
				<el-button type="primary" @click="updateAutoFationSettings" size="mini">确定</el-button>
			</div>
		</el-dialog>
	</el-row>
	<el-row>
		<el-button-group>
		  	<el-button size="mini">{{ fation_task_rate + '%' }}</el-button>
		  	<el-button type="success" size="mini">{{ fation_task_ok }}</el-button>
		  	<el-button type="warning" size="mini">{{ fation_task_fail }}</el-button>
		  	<el-button type="primary" size="mini">{{ fation_task_total }}</el-button>
			<el-button @click="fationTaskReset" size="mini" icon="el-icon-refresh-left" type="danger"></el-button>
		</el-button-group>
	</el-row>
	<el-row>
		自动战斗
		<el-switch
			v-model="stores.autoBattle"
		  	active-color="#13ce66"
		  	inactive-color="#ff4949">
		</el-switch>
	</el-row>
	<el-row>
		<el-button-group>
		  	<el-button size="mini">{{ bat_rate + '%' }}</el-button>
		  	<el-button type="success" size="mini">{{ bat_ok }}</el-button>
		  	<el-button type="warning" size="mini">{{ bat_fail }}</el-button>
		  	<el-button type="primary" size="mini">{{ bat_total }}</el-button>
			<el-button @click="batReset" size="mini" icon="el-icon-refresh-left" type="danger"></el-button>
		</el-button-group>
	</el-row>
	<el-row>		
		<el-button-group>
			<el-button type="success" size="mini">{{ expPerSecond }}</el-button>
			<el-button type="primary" size="mini">{{ nextLevelUpAt }}</el-button>
			<el-button type="warning" size="mini">{{ levelUpPercentage + '%' }}</el-button>
		</el-button-group>
	</el-row>
	<el-card class="box-card" :body-style="{ padding: '5px' }">
		<div slot="header" class="clearfix">
			<span>时间管理</span>
			<el-switch
				v-model="stores.autoFarm"
				active-color="#13ce66"
				inactive-color="#ff4949">
			</el-switch>
			<el-dialog title="请选择Fallback" :visible.sync="dialogFallbackFormVisible" :modal="false" :append-to-body="true">
				<el-form label-width="120px">
					<el-form-item label="fallback">
						<el-select v-model="stores.fallbackId" style="width: 100%;">
							<el-option v-for="screen in battleScreens" :key="screen._id" :label="screen.name" :value="screen._id"></el-option>
						</el-select>
					</el-form-item>
				</el-form>
				<div slot="footer" class="dialog-footer">
					<el-button type="primary" @click="dialogFallbackFormVisible = false">确定</el-button>
				</div>
			</el-dialog>
			
			<el-button v-if="stores.autoFarm" style="float: right; padding: 3px 0" type="text" 
				@click="stores.battleSchedules = []">
				重置
			</el-button>
			<el-button v-if="stores.autoFarm" style="float: right; padding: 3px 0" type="text" 
				@click="dialogScheduleFormVisible = true">
				新增
			</el-button>
			<el-dialog title="新增Schedule" :visible.sync="dialogScheduleFormVisible" :modal="false" :append-to-body="true">
				<el-form :model="form" label-width="120px">
					<el-form-item label="时间">
						<el-time-select style="width: 100%;"
							:picker-options="{
								start: '00:00',
								step: '00:15',
								end: '23:59'
							}"
							v-model="form.screenTime"
							placeholder="选择时间">
						</el-time-select>
					</el-form-item>
					<el-form-item label="副本">
						<el-select v-model="form.screenId" style="width: 100%;">
							<el-option v-for="screen in battleScreens" :key="screen._id" :label="screen.name" :value="screen._id"></el-option>
						</el-select>
					</el-form-item>
				</el-form>

				<div slot="footer" class="dialog-footer">
					<el-button type="primary" @click="dialogScheduleFormVisible = false">取消</el-button>
					<el-button type="success" @click="addNewSchedule">确定</el-button>
				</div>
			</el-dialog>
	  	</div>
	  	<div v-for="sch in stores.battleSchedules" class="text item">
			{{ sch.time + ' : ' + sch.screenName }}
	  	</div>
	  	<div v-if="stores.fallbackId">
	  		fallback : {{ fallbackName }} <el-button @click="dialogFallbackFormVisible = true">修改</el-button>
		</div>
	</el-card>
	<el-table :show-header="false"
		  	:data="latestBatchLogs"
		  	size="mini"
		  	style="width: 100%">
		<el-table-column
			label="Time">
			<template slot-scope="scope">
				<el-tag :type="scope.row.win ? 'success' : 'danger'" size="mini" >{{ scope.row.atTime }}</el-tag>
			</template>
		</el-table-column>
		<el-table-column
			prop="exp"
			label="Exp">
		</el-table-column>
		<el-table-column
			label="Goods">
			<template slot-scope="scope">
				<template v-if="scope.row.reward.goods">
					<el-tag v-for="(gd, index) in scope.row.reward.goods" v-bind:key="index" size="mini">{{ gd.gname }}</el-tag>
				</template>
			</template>
		</el-table-column>
		<el-table-column label="Operations">
			<template slot-scope="scope">
				<el-button size="mini" @click="showDetailLog(scope.$index, scope.row)">日志</el-button>
				<el-dialog title="战斗日志" :visible.sync="dialogShowDetailLogVisible" :modal="false" :append-to-body="true">
					<div style="text-align: left;" v-html="temp.detail.join('<br/>')"></div>
				</el-dialog>
			</template>
		</el-table-column>
	</el-table>
</div>`)

	function log(str) {
		if (consolelog) {
			console.log(str)
		}
	}

	const routes = [
		["connector.userHandler.getUserTask", "getUserTask"],
		["connector.fationHandler.getFationTask", "getFationTask"],
		["connector.fationHandler.closeUserTask", "closeUserTask"],
		["connector.playerHandler.payUserTask", "payUserTask"],
		["connector.teamHandler.getTeamList", "getTeamList"],
		["connector.userHandler.userInfo", "userInfo"],
		["connector.playerHandler.moveToNewMap", "moveToNewMap"],
		["connector.userHandler.getMyGoods", "getMyGoods"],
		["connector.userHandler.useGoods", "useGoods"],
		["connector.userHandler.wbt", "wbt"],
	]
	let routeHandlers = {}
	routes.forEach(route => {
		routeHandlers[route[1]] = function (params) {
			params = params || {}

			return new Promise((resolve, reject) => {
				pomelo.request(route[0], params, function (data) {
					resolve(data)
				})
			})
		}
	})

	const helpers = {
		fetchAllGoods: async function () {
			let goods = []
			for (let i = 1;; i++) {
				let data = await routeHandlers.getMyGoods({
					page: i
				})

				if (data.data.goods.length === 0) {
					break
				} else {
					goods = goods.concat(data.data.goods)
				}
			}

			return goods
		},
		useGoods: async function (goods) {
			for (let i = 0; i < goods.length; i++) {
				let good = goods[i]

				for (let count = 0; count < good.count; count++) {
					log("使用藏宝图")
					await sleep(1100)
					await routeHandlers.useGoods({
						gid: good._id
					})
				}
			}
		},
		wbt: async function (goods) {
			for (let i = 0; i < goods.length; i++) {
				log("挖宝")
				let good = goods[i]
				await sleep(1100)
				let targetMapName = good.info.match(/【(.*)】/)[1]
				log(targetMapName)
				log(global.mid, mapsKeyByName[targetMapName].id)
				await autoMove(getPath(global.mid, mapsKeyByName[targetMapName].id))
				let wbtRes = await routeHandlers.wbt({
					ugid: good._id
				})
				log(wbtRes)
			}
		},
		// 自动挖宝 挖宝前记录位置, 挖宝后自动返回
		autoWbt: function () {
			let restoreMid = global.mid
			helpers.fetchAllGoods()
				.then(allGoods => {
					// 使用所有藏宝图
					helpers.useGoods(allGoods.filter(g => g.hasOwnProperty('goods') && ["藏宝图", "高级藏宝图"].includes(g.goods.name)))
						.then(_ => {
							helpers.fetchAllGoods().then(allGoods => {
								helpers.wbt(allGoods.filter(g => g.hasOwnProperty('name') && g.name.indexOf("藏宝图") > -1)).then(_ => {
									autoMove(getPath(global.mid, restoreMid))
								})
							})
						})
				})
		}
	}

	const promiseTimeout = function(ms, promise) {

		// Create a promise that rejects in <ms> milliseconds
		let timeout = new Promise((resolve, reject) => {
			let id = setTimeout(() => {
				clearTimeout(id);
				reject('Timed out in '+ ms + 'ms.')
			}, ms)
		})

		// Returns a race between our timeout and the passed in promise
		return Promise.race([
			promise,
			timeout
		])
	}

	function sleep(ms) {
		return new Promise((resolve) => {
			setTimeout(resolve, ms);
		});
	}

	const waitSeconds = 1100
	function autoFationTaskHandler() {
		if (! who_app.stores.autoFation) {
			log('停刷')
			return
		}

		if (who_app.autoFationLastRunAt !== null) {
			if (moment().diff(who_app.autoFationLastRunAt, seconds) <= 150) {
				log('已经在运行了')
				return
			} else {
				who_app.autoFationLastRunAt = moment()
			}
		}

		routeHandlers.getUserTask().then(res => {
			log('auto fation start')
			log(res)
			if (res.code === 200) {
				let datum = res.data.find(datum => datum.task.task_type === 4)
				if (datum) {
					// 扩充任务库
					let task = who_app.stores.allFationTasks.find(task => task._id === datum.task._id)
					log(task)
					if (! task) {
						// 默认为可做可不做
						datum.task.who_action = 2
						who_app.stores.allFationTasks.push(datum.task)
					} else {
						datum.task.who_action = task.who_action
					}

					log(datum)

					if (datum.task.who_action === 1) {

						sleep(waitSeconds).then(_ => {
							routeHandlers.payUserTask({utid: datum.utid}).then(res => {
								log(res)
								if (res.code === 200) {

									who_app.fation_task_ok++
									who_app.fation_task_total++

									log('任务完成')
									sleep(waitSeconds).then(_ => autoFationTaskHandler())
								} else if (res.code === 400) {
									// 任务材料不足终止循环
									log('材料不足 终止循环')
								}
							})
						})

					} else if (datum.task.who_action === 2) {

						sleep(waitSeconds).then(_ => {
							routeHandlers.payUserTask({utid: datum.utid}).then(res => {
								if (res.code === 200) {

									who_app.fation_task_ok++
									who_app.fation_task_total++

									log('任务完成')
									sleep(waitSeconds).then(_ => autoFationTaskHandler())
								} else if (res.code === 400) {
									// 任务材料不足放弃任务
									log('材料不足 放弃任务')
									sleep(waitSeconds).then(_ => {
										routeHandlers.closeUserTask({tid: datum.utid}).then(res => {

											who_app.fation_task_fail++
											who_app.fation_task_total++

											sleep(waitSeconds).then(_ => autoFationTaskHandler())
										})
									})

								}
							})
						})

					} else if (datum.task.who_action === 3) {

						sleep(waitSeconds).then(_ => {
							routeHandlers.closeUserTask({tid: datum.utid}).then(res => {

								who_app.fation_task_fail++
								who_app.fation_task_total++

								log('放弃任务')
								sleep(waitSeconds).then(_ => autoFationTaskHandler())
							})
						})
					}
				} else {
					sleep(waitSeconds).then(_ => {
						routeHandlers.getFationTask().then(res => {
							if (res.code === 200) {
								log('接任务')
								sleep(waitSeconds).then(_ => autoFationTaskHandler())
							} else {
								log(res)
							}
						})
					})
				}
			}
		})
	}

	let stores = GM_getValue(getKey('stores'), {})

	unsafeWindow.who_app = new Vue({
		el: "#whoapp",
		data: function () {
			return {
				bat_auto_interval: null,
				bat_ok: 0,
				bat_fail: 0,
				bat_total: 0,

				fation_task_ok: 0,
				fation_task_fail: 0,
				fation_task_total: 0,
				autoFationLastRunAt: null,

				batLogs: [],
				battleScreens: [],
				dialogScheduleFormVisible: false,
				dialogFallbackFormVisible: false,
				dialogShowDetailLogVisible: false,
				dialogAutoFationSettings: false,
				form: {
					screenId: '',
					screenTime: '',
				},
				logData: false,

				// 平滑重启( 当前战斗结束后重启, 避免重载后导致战斗延迟6秒 )
				gracefulReload: false,

				temp: {
					detail: []
				},

				allGoods: [],

				myTeam: {},

				levelUpPercentage: 0,
				nextLevelUpAt: '-',

				intervalIds: {},
				laterInstances: [],

				stores: {
					autoBattle: stores.hasOwnProperty("autoBattle") ? stores.autoBattle : false,
					battleSchedules: stores.hasOwnProperty("battleSchedules") ? stores.battleSchedules : [],
					fallbackId: stores.hasOwnProperty("fallbackId") ? stores.fallbackId : "",
					autoFarm: stores.hasOwnProperty("autoFarm") ? stores.autoFarm : false,
					autoFation: stores.hasOwnProperty("autoFation") ? stores.autoFation : false,
					allFationTasks: stores.hasOwnProperty("allFationTasks") ? stores.allFationTasks : [],
				}
			}
		},
		mounted() {
			this.turnOffSystemAutoBattle()

			later.date.localTime()
			this.applyBattleSchedules()

			// 如果过去五分钟无战斗, 则尝试开启战斗
			setInterval(_ => {
				if (this.stores.autoBattle) {
					if (this.batLogs.length === 0
						|| moment().diff(this.batLogs[0].at, 'seconds') >= 300) {
						startBatFunc()
					}
				}
			}, 300000)

			pomelo.on('onRoundBatEnd', res => {
				let roundArr = res.data.round_arr
				let roundStatus = res.data.round_status
				let players = roundStatus.filter(s => s.is_palyer).map(s => s.name)

				if (players.length < 5) {
					// 定时更新成员

					// 队伍未满员

					// 队伍中成员离线
				}

				if (res.data.round_num === 1) {
					// 第一回合
					roundArr.forEach(ra => {
						if (players.includes(ra.a_name) && ra.process === "物理攻击") {
							// 该玩家没有使用开启技能或者没有足够的蓝使用技能

						}
					})
				}

				if (res.data.win > 0) {
					if (this.gracefulReload) {
						this.pageReload()
					}

					// 保留最近50场战斗的详细记录
					let _detailLog = []
					$($('#logs').children().get().reverse()).each((index, node) => _detailLog.push(node.innerText))

					if (this.logData) {
						log(res.data)
					}

					if (this.stores.autoBattle) {
						log('auto start')
						startBatFunc()
					}

					let _batLog
					let now = moment()

					if (res.data.win === 1) {
						if (res.data.exp.length === 0) {
							log('全队无收益')
							this.$notify({
								title: '警告',
								message: '全队无收益',
								type: 'warning'
							});

							// 无收益自动切换为fallback副本
							if (this.stores.autoFarm && this.stores.fallbackId) {
								selectBatIdFunc(this.stores.fallbackId, this.fallbackName)
							}
						}

						let myExp = res.data.exp.find(e => e.name === who_user.nickname)
						let myReward = res.data.player_reward.find(e => e.name === who_user.nickname)

						_batLog = {
							win: true,
							atTime: now.format('HH:mm:ss'),
							at: now,
							exp: myExp ? Math.round(myExp.exp, 2) : 0,
							expRate: myExp ? myExp.exp_rate : 0,
							reward: myReward ? myReward : [],
							detail: _detailLog,
							round_num: res.data.round_num
						}

						this.bat_ok++
					} else {
						_batLog = {
							win: false,
							atTime: now.format('HH:mm:ss'),
							at: now,
							exp: 0,
							expRate: 1,
							reward: [],
							detail: _detailLog,
							round_num: res.data.round_num
						}

						this.bat_fail++
					}

					if (this.batLogs.unshift(_batLog) > 99) {
						this.batLogs.pop()
					}

					this.bat_total++
				}
			})

			setInterval(_ => {
				if (this.expPerSecond > 0) {
					let needExp = who_user.nextLevelGetExp - who_user.exp

					this.levelUpPercentage = who_user.exp > who_user.nextLevelGetExp ? 100 : (who_user.exp*100/who_user.nextLevelGetExp).toFixed(2)

					needExp = needExp < 0 ? 0 : needExp
					this.nextLevelUpAt = moment().add(needExp / this.expPerSecond, 'second').format('DD HH:mm')
				}
			}, 6000)

			routeHandlers.getTeamList({
				mid: this.getMid(),
			}).then(res => {
				if (res.code === 200) {
					this.battleScreens = res.data.screens
				}
			})

			setInterval(_ => {
				routeHandlers.getTeamList({
					mid: this.getMid(),
				}).then(res => {
					if (res.code === 200) {
						this.myTeam = res.data.myTeam ? res.data.myTeam : {}
					}
				})
			}, 30000)

			// 自动帮派任务
			this.switchAutoFation()
		},
		watch: {
			myTeam(n, o) {
				// 如果队伍不满员
				if (n.users) {
					let maxPlayerNum = n.combat ? n.combat.player_num : 5
					let currentPlayerNum = n.users.length

					if (o.users && o.users.length) {
						let diff = _.differenceBy(n.users, o.users, 'nickname')
						let rdiff = _.differenceBy(o.users, n.users, 'nickname')

						if (rdiff.length) {
							log(_.map(rdiff, 'nickname').join(',') + ' 离队')
						}

						if (diff.length) {
							log(_.map(diff, 'nickname').join(',') + ' 入队')
						}
					}

					if (currentPlayerNum < maxPlayerNum) {
						log('队伍未满员')
					}
				}
			},
			"levelUpPercentage": function (n) {
				$('#whoExpBar').css('width', `${n}%`)
			},
			"stores.autoFarm": function () {
				if (this.stores.autoFarm) {
					if (! this.stores.fallbackId) {
						this.dialogFallbackFormVisible = true

						this.stores.autoFarm = false
					}
				}

				this.persistentStores()
			},
			"stores.autoBattle": function (n) {
				this.turnOffSystemAutoBattle()

				if (n) {
					log('auto start')
					startBatFunc()
				}

				this.persistentStores()
			},
			"stores.battleSchedules": function () {
				this.persistentStores()
			},
			"stores.fallbackId": function () {
				this.persistentStores()
			},
			"stores.autoFation": function () {
				this.switchAutoFation()
				this.persistentStores()
			},
			"stores.allFationTasks": function () {
				this.persistentStores()
			}
		},
		computed: {
			battleScreensKeyById() {
				let data = {}
				this.battleScreens.map(s => {
					data[s._id] = s
				})

				return data
			},
			fallbackName() {
				let screen = this.battleScreens.find(s => s._id === this.stores.fallbackId)

				if (typeof screen === "undefined") {
					return '';
				}

				return screen.name
			},
			bat_rate() {
				if (this.bat_total) {
					return (this.bat_ok * 100 / this.bat_total).toFixed(1)
				} else {
					return 0
				}
			},
			fation_task_rate() {
				if (this.fation_task_total) {
					return (this.fation_task_ok * 100 / this.fation_task_total).toFixed(1)
				} else {
					return 0
				}
			},
			latestBatchLogs() {
				return this.batLogs.slice(0, 5)
			},
			expPerSecond() {
				let logs = this.batLogs.slice(0, 30)
				let length = logs.length

				if (length < 2) {
					return 0;
				}

				let latest = logs[0];
				let oldest = logs[length - 1]

				let seconds = latest.at.diff(oldest.at, 'seconds')

				let totalExp = 0 - oldest.exp
				logs.map(log => {
					totalExp+= log.exp
				})

				return (totalExp / seconds).toFixed(2)
			},
			treasureMaps() {
				return this.allGoods.filter(g => {
					return g.hasOwnProperty('goods') && ["藏宝图", "高级藏宝图"].includes(g.goods.name);
				})
			},
			usedTreasureMaps() {
				return this.allGoods.filter(g => {
					return g.hasOwnProperty('name') && g.name.indexOf("藏宝图") > -1;
				})
			}
		},
		methods: {
			switchAutoFation() {
				if (this.intervalIds.hasOwnProperty("autoFation")) {
					clearInterval(this.intervalIds.autoFation)
				}

				if (this.stores.autoFation) {
					autoFationTaskHandler()
					this.intervalIds.autoFation = setInterval(_ => {
						autoFationTaskHandler()
					}, 300000)
				}
			},
			showDetailLog(index, row) {
				this.temp.detail = row.detail
				this.dialogShowDetailLogVisible = true
			},
			addNewSchedule() {
				this.stores.battleSchedules.push({
					time: this.form.screenTime,
					screenId: this.form.screenId,
					screenName: this.battleScreensKeyById[this.form.screenId].name
				})

				this.form.screenId = ''
				this.form.screenTime = ''
				this.dialogScheduleFormVisible = false
			},
			format(percentage) {
				return `${this.expPerSecond}(s) / ${this.nextLevelUpAt} / ${percentage}%`
			},
			formatNeedGoods(task) {
				let temp = {}
				task.need_goods_num.map(gd => temp[gd.id] = gd.count)

				return task.need_goods.map(gd => gd.name + 'x' + temp[gd._id]).join(' ')
			},
			formatGivenGoods(task) {
				let temp = {}
				task.give_goods_num.map(gd => temp[gd.id] = gd.count)

				let formatted = ''
				if (task.contribution_num) {
					formatted+= `帮贡:${task.contribution_num} `
				}

				if (task.repair_num) {
					formatted+= `修为:${task.repair_num} `
				}

				if (task.give_goods.length) {
					formatted+= '物品:' + task.give_goods.map(gd => gd.name + ' x ' + temp[gd._id]).join(' ') + ' '
				}

				if (task.game_gold) {
					formatted+= `仙石:${task.game_gold} `
				}

				if (task.game_silver) {
					formatted+= `灵石:${task.game_silver} `
				}

				return formatted
			},
			updateAutoFationSettings() {
				this.dialogAutoFationSettings = false
				this.persistentStores()
			},
			turnOffSystemAutoBattle() {
				if (this.stores.autoBattle) {
					// 关闭系统的循环开关
					localStorage.removeItem('for_bat')
				}
			},
			batReset() {
				this.bat_ok = 0
				this.bat_fail = 0
				this.bat_total = 0
			},
			fationTaskReset() {
				this.fation_task_ok = 0
				this.fation_task_fail = 0
				this.fation_task_total = 0
			},
			persistentStores() {
				log('persistentStores...')
				GM_setValue(getKey('stores'), this.stores)
			},
			applyBattleSchedules() {
				this.laterInstances.map(instance => instance.clear())

				this.stores.battleSchedules.map(s => {
					log('load auto farm screen ' + s.screenName)
					this.laterInstances.push(
						later.setInterval(function () {
							log('auto select screen ' + s.screenName)
							selectBatIdFunc(s.screenId, s.screenName)
						}, later.parse.text(`at ${s.time}`))
					)
				})
			},
			getMid() {
				return typeof global === "undefined" ? 1 : (typeof global.mid !== "undefined" ? global.mid : 1)
			},
			pageReload() {
				location.href = "/login?is_r=1"
			},
			reloadIfOffline() {
				promiseTimeout(5000, routeHandlers.userInfo())
					.then(res => {
						log('still alive')
					})
					.catch(error => {
						log(error)
						location.href = "/login?is_r=1"
					})
			},
			moveTo(from, to, by) {
				by = by || 'id'
				if (by === 'name') {
					from = mapsKeyByName[from].id
					to = mapsKeyByName[to].id
				}

				autoMove(getPath(from, to)).then(s => {
					// 移动完成
					log('auto move over')
				})
			},
			fetchAllGoods() {
				helpers.fetchAllGoods().then(gs => this.allGoods = gs)
			}
		}
	})
}, 1000)

