import React from 'react';
import { View, StyleSheet, ViewStyle, Text, ActivityIndicator, Alert, Platform, Linking } from 'react-native';
import { observer, inject } from 'mobx-react/native';
import { Store } from '@/store';
import { Feedback as FeedbackModel, AccountInPage, Ret } from '@/store/types';
import { observable, runInAction } from 'mobx';
import BasePage from './BasePage';
import { req, like, favorite, reply, deleteReply } from '@/store/web';
import { retryDo } from '@/kit';
import { SCREEN_WIDTH, SCREEN_HEIGHT } from '@/components/kit';
import { ICON_BLUE } from '@/themes/color';
import { baseUrl } from '@/kit/req';
import { Toast, Modal, ActionSheet } from 'antd-mobile-rn';
import Router from '@/router';
const cheerio: CheerioAPI = require('react-native-cheerio');

interface Props {
	store?: Store;
	id: number;
}

@inject('store')
@observer
export default class FeedbackPage extends React.Component<Props> {
	@observable
	feedback: FeedbackModel = {
		id: 0,
		accountId: 0,
		projectId: 0,
		title: '',
		content: '',
		createAt: '',
		clickCount: 0,
		report: 0,
		likeCount: 0,
		favoriteCount: 0
	};

	@observable favorited: boolean = false;
	@observable liked: boolean = false;

	@observable
	author: AccountInPage = {
		id: 0,
		nickName: '',
		avatar: ''
	};

	@observable loading = false;

	render() {
		return (
			<View style={styles.container}>
				<BasePage
					onShare={this.onShare}
					onFavorite={this.onFavorite}
					onLike={this.onLike}
					openOnBrowser={this.openOnBrowser}
					html={this.feedback.content}
					centerElementInTopBar={this.feedback.title}
					favoriteCount={this.feedback.favoriteCount}
					likeCount={this.feedback.likeCount}
					onWebViewEmit={this.onWebViewEmit}
					favorited={this.favorited}
					liked={this.liked}
				/>
				<ActivityIndicator animating={this.loading} style={styles.loading} color={ICON_BLUE} />
			</View>
		);
	}

	private onFavorite = async () => {
		if (!this.props.store!.me) {
			Router.login();
			return;
		}
		if (this.feedback.accountId === this.props.store!.me!.id) {
			Toast.info('不能收藏自己的文章', 1.5);
			return;
		}
		const ret = await favorite('feedback', this.feedback.id, !this.favorited);
		if (ret.isOk) {
			runInAction(() => {
				this.favorited = !this.favorited;
				if (this.favorited) this.feedback.favoriteCount++;
				else this.feedback.favoriteCount--;
			});
			Toast.success(`${this.favorited ? '' : '取消'}收藏成功`, 0.8);
		} else {
			Toast.fail(ret.get('msg'), 1.5);
		}
	};

	private onLike = async () => {
		if (!this.props.store!.me) {
			Router.login();
			return;
		}
		if (this.feedback.accountId === this.props.store!.me!.id) {
			Toast.info('不能点赞自己的文章', 1.5);
			return;
		}
		const ret = await like('feedback', this.feedback.id, !this.liked);
		if (ret.isOk) {
			runInAction(() => {
				this.liked = !this.liked;
				if (this.liked) this.feedback.likeCount++;
				else this.feedback.likeCount--;
			});
			Toast.success(`${this.liked ? '' : '取消'}点赞成功`, 1.5);
		} else {
			Toast.fail(ret.get('msg'), 1.5);
		}
	};

	private onShare = () => {
		if (Platform.OS === 'ios') {
			ActionSheet.showShareActionSheetWithOptions({
				url: `${baseUrl}/feedback/${this.props.id}`,
				message: this.feedback.title,
				title: '分享'
			});
		} else {
			ActionSheet.showShareActionSheetWithOptions({
				message: this.feedback.title + ` ${baseUrl}/feedback/${this.props.id}`,
				title: '分享'
			});
		}
	};

	openOnBrowser = ()=>{
		Linking.openURL(`${baseUrl}/feedback/${this.props.id}`); 
	};

	onWebViewEmit = async (payload: any) => {
		if (payload.action === 'openUser') {
			if (this.props.store!.me && this.props.store!.me!.id === payload.id) {
				Modal.alert('跳转到我的主页？', '将无法返回此页', [
					{ text: '确认', onPress: () => Router.me() },
					{ text: '取消', onPress: () => null }
				]);
			} else Router.user(payload.id);
		} else if (payload.action === 'openProject') {
			if (payload.id) {
				Router.projectPage(payload.id);
			} else {
				Router.project();
			}
		} else if (payload.action === 'openShare') {
			if (payload.id) {
				Router.sharePage(payload.id);
			} else {
				Router.share();
			}
		} else if (payload.action === 'openFeedback') {
			if (payload.id) {
				Router.feedbackPage(payload.id);
			} else {
				Router.feedback();
			}
		}else if (payload.action === 'openDoc') {
			if (payload.uri) {
				Router.doc(payload.uri);
			} else {
				Router.doc();
			}
		} else if (payload.action === 'reply') {
			if (!this.props.store!.me) {
				Router.login();
				return;
			}
			const text = payload.value;
			const ret = await reply('feedback', this.feedback.id, text);
			if (ret.isOk) {
				return { ok: true, replyItem: ret.get('replyItem') };
			} else {
				return { ok: false, msg: ret.get('msg') };
			}
		} else if (payload.action === 'deleteReply') {
			const confirm = await new Promise<boolean>((resolve) => {
				Modal.alert('确认删除回复？', '删除无法撤销。', [
					{
						text: '确认',
						onPress: () => {
							resolve(true);
						}
					},
					{
						text: '取消',
						onPress: () => {
							// closer.close();
							resolve(false);
						}
					}
				]);
			});
			if (confirm) {
				const id = payload.id;
				const ret = await deleteReply('share', id);
				if (ret.isOk) {
					return { ok: true };
				} else {
					return { ok: false, msg: ret.get('msg') };
				}
			}
		}
	};

	componentDidMount() {
		(async () => {
			this.loading = true;
			try {
				const html = await retryDo(async () => {
					const resp = await req.GET(`/feedback/${this.props.id}`, null, {
						responseType: 'text'
					});
					return resp.data;
				}, 3);
				const $ = cheerio.load(html);
				let replyList = $('.jf-reply-list').html()!;
				if ($('.jf-paginate').length > 0) {
					const linkes = $('.jf-paginate > li > a').toArray();
					const total = Number.parseInt($(linkes[linkes.length - 2]).text().trim());
					const htmls = await Promise.all(
						Array.from(new Array(total - 1), (v, i) => i + 2).map((p) =>
							retryDo(async () => await req.GET_HTML(`/share/${this.props.id}?p=${p}`), 3)
						)
					);
					if (htmls.length > 0) {
						// 去掉输入框
						replyList = replyList.substring(0, replyList.lastIndexOf('<li'));
						for (let i = 0; i < htmls.length; i++) {
							const $ = cheerio.load(htmls[i]);
							replyList += $('.jf-reply-list').html();
							if (i < htmls.length - 1) {
								// 去掉输入框
								replyList = replyList.substring(0, replyList.lastIndexOf('<li'));
							}
						}
					}
				}
				runInAction(() => {
					this.feedback.id = this.props.id;
					let avatar = $('.jf-article-meta > a > img').attr('src');
					this.author.avatar = avatar;
					this.author.nickName = $('.jf-article-meta > a > span').text().trim();
					const authorUri = $('.jf-article-meta > a').attr('href');
					this.author.id = Number.parseInt(authorUri.substring(authorUri.lastIndexOf('/') + 1));
					this.feedback.title = $('.jf-article-title').text().trim();
					this.feedback.createAt = $('.jf-article-create-at').text().trim();
					this.favorited = $('i.iconfont.icon-favorite').hasClass('active');
					this.liked = $('i.iconfont.icon-like').hasClass('active');
					this.feedback.content = `
						<html>
							<head>
								${$('head').html()}
								<style> 
									p, li, span, div{
										font-size: 14px !important; 
									}
									body{
										background-color:#ffffff  !important;
									}
									.jf-panel-box {
										width: 100% !important;
										line-height: 1.5;
										font-size: 18px;
										padding: 0 10px 0 10px !important;
									}
									pre{
										overflow: auto;
									}
									pre li {
										white-space: nowrap; 
									}
									.jf-article{
										margin: 0 !important; 
										box-shadow: none !important;
										border: none !important;
										padding: 0 !important;
									}
									.jf-article-title{
										text-align:start; 
									}

								</style>
							</head>
							<body> 
								<div class="jf-panel-box">
									<div class="jf-article">
										<h1 class="jf-article-title">${this.feedback.title}</h1>
										<div class="jf-article-meta">
											<a id="author">
												<img src="${avatar}">
												<span>${this.author.nickName}</span>
											</a>
											<span class="jf-article-create-at">${this.feedback.createAt}</span>
										</div>
										<div class="jf-article-content">
											${$('.jf-article-content').html()}
										</div>
										<div class="jf-article-footer clearfix">
											<span class="jf-tag-label">项目：</span>
											<a class="jf-tag" href="${$('div.jf-article-footer.clearfix > a').attr('href')}" target="_blank">
												${$('div.jf-article-footer.clearfix > a').text()}
											</a>
										</div>
									</div>
									
									<div class="jf-reply" >
										<h2>评论</h2>
										<ul class="jf-reply-list">
											${replyList} 
										</ul>
									</div>

									<style>
										.jf-reply{
											margin: auto !important;
											padding: unset !important;
											box-shadow: none !important;
											border: none !important;
											border-radius: unset !important;
										}
										.jf-reply-item{
											margin-left: 48px !important; 
										}
										.jf-reply-input-box{
											position: unset !important;
											display: flex;
										}
										#submit_btn{
											position: unset !important;
											height: fit-content;
										} 
										.jf-reply-mini-editor{
											flex:1;
										}
										.jf-reply-delete {
											visibility: visible;
										}
									</style>

								</div>    
								<script src="https://cdn.bootcss.com/zepto/1.2.0/zepto.min.js"></script> 
								<script type="text/javascript" src="/assets/prettify/prettify.js"></script>
								<script type="text/javascript"> 
									$(document).ready(function() {
										setTimeout(function(){
											$("pre").addClass("prettyprint linenums");
											prettyPrint();
										}, 300);

										try{
											$("img").each(function(){
												if ($(this).attr("src").match(/\?\w+=/)){
													$(this).attr("src", $(this).attr("src")+"&noCache="+Math.random()); 
												}else{
													$(this).attr("src", $(this).attr("src")+"?noCache="+Math.random()); 
												}
											});
										}catch(e){}

										try{
											$("#author").on("click", function(){ 
												send({action:"openUser", id: ${this.author.id}}); 
											}); 
										}catch(e){}
										
										var map = new Map(); 
										function regOne(elem, eventName, handler){
											if (!map.has(elem)){
												map.set(elem, new Map());
											}
											if (!map.get(elem).has(eventName)){
												$(elem).on(eventName, handler);
												map.get(elem).set(eventName, true); 
											}
										}
										
										function regEvent(){
											[
												{name:"project", action:"openProject"}, 
												{name:"share", action:"openShare"}, 
												{name:"feedback", action:"openFeedback"},
												{name:"user", action:"openUser"},
												{name:"doc", action:"openDoc"},
											].forEach(function(item){
												if(item.name !== 'doc'){
													$('a[href^="' + "/" + item.name + '"]').each(function(){
														try{
															var elem = $(this); 
															regOne(this, "click", function(e){
																e.preventDefault(); 
																e.stopPropagation();  
																var href = elem.attr("href"); 
																if (href==='/'+item.name){
																	send({action:item.action}); 	
																}else{
																	send({
																		action:item.action, 
																		id: Number.parseInt(href.substring(href.lastIndexOf("/")+1))
																	}); 
																}
															})
														}catch(e){}
													});
													$("a").each(function(){
														try{
															var href = $(this).attr('href');
															var res = new RegExp('www\\.jfinal\\.com/'+item.name+'/\\\\d+').exec(href); 
															if(res){
																var id = Number.parseInt(res[0].match(/\\d+/)[0]); 
																regOne(this, "click", function(evt){
																	evt.preventDefault(); 
																	send({
																		action: item.action, 
																		id: id
																	}); 
																})
															}
														}catch(e){}
													});
												}else{
													$("a").each(function(){
														try{
															var href = $(this).attr('href');
															var res = /((^(http:\\/\\/)?www.jfinal.com)|^)\\/doc.*$/.exec(href); 
															if(res){
																var uri = href.match(/\\/doc.*/)[0]; 
																regOne(this, "click", function(evt){
																	evt.preventDefault(); 
																	send({
																		action: item.action, 
																		uri: uri
																	}); 
																})
															}
														}catch(e){}
													});
												}
											});	

											var logged = ${this.props.store!.me ? true : false}; 

											var replyInput = $("#replyContent");

											regOne(replyInput.get(0), "input", function () {
												this.style.height = this.scrollHeight+'px'; 
											});
	
											$(".jf-reply-list > li").each(function(){
												try{
													var userName = $(this).find(".jf-reply-user-name > a").text().trim(); 
													regOne(
														$(this).find(".jf-reply-link").get(0), 
														"click", 
														function(e){
															e.preventDefault(); 
															if (!logged)
																alert("请登录"); 
															else
																replyInput.val(replyInput.val()+"@"+userName+" "); 
														});
												}catch(e){}												
											});  
											try{
												regOne($("#submit_btn").get(0), "click", function(e){
													e.preventDefault();  
													if (replyInput.val().trim() === ''){
														alert("请输入内容");
													}else{
														send({action:"reply", value: replyInput.val()})
															.then(function(result){ 
																if (result.ok){
																	$(result.replyItem).insertBefore("ul.jf-reply-list > li:last-child")
																	replyInput.val(''); 
																	regEvent(); 
																}else{
																	alert(result.msg); 
																}
															}); 
													} 
												});	
											}catch(e){}
											$(".jf-reply-delete").each(function(){
												try{
													var onclick = $(this).attr("onclick"); 
													$(this).attr("onclick", null); 
													var id = Number.parseInt(onclick.substring(onclick.indexOf("id=")+3).trim());
													regOne(this, "click", function(){
														var self = $(this); 
														send({action: "deleteReply", id: id}).then(function(result){
															if (result.ok){
																self.parents('li').remove(); 
																regEvent(); 
															}
														});
													});
												}catch(e){ }
											}); 
										}
										regEvent(); 										
										
										$(".jf-paginate").remove(); 
									});
								</script>
							</body>
						</html>
					`;
					this.feedback.favoriteCount = Number.parseInt(
						$('div.jf-article > div.jf-article-footer.clearfix > div > span:nth-child(2)').text().trim() ||
							'0'
					);
					this.feedback.likeCount = Number.parseInt(
						$('div.jf-article > div.jf-article-footer.clearfix > div > span:nth-child(4)').text().trim() ||
							'0'
					);
					this.loading = false;
				});
			} catch (e) {
				Alert.alert('网络请求错误', e.toString(), [ { text: 'OK', onPress: () => Router.pop() } ], {
					cancelable: false
				});
				this.loading = false;
			}
		})();
	}
}

const styles = StyleSheet.create({
	container: { flex: 1 } as ViewStyle,
	loading: {
		position: 'absolute',
		width: SCREEN_WIDTH,
		height: SCREEN_HEIGHT,
		justifyContent: 'center',
		alignItems: 'center'
	} as ViewStyle
});

let addCacheClear: boolean = false;
