import { observable, computed, action } from 'mobx';
import { ListViewComponent } from 'react-native';

export interface AccountInPage {
	id: number; // 82497;
	nickName: string; // 'fuchuan';
	avatar: string; // '16/82497.jpg';
}

export interface Account extends AccountInPage {
	/*
	 	avatar : "16/82497.jpg"
		createAt : "2017-11-13 10:00:42"
		id : 82497 
		ip : "117.136.86.38"
		likeCount : 0
		nickName : "fuchuan"
		sessionId : "bf8f66506d014871902391a935a9d713"
		status : 1
		userName : "fuchuanofchina@gmail.com"
	*/
	userName: string; // 'fuchuanofchina@gmail.com';
	createAt: string; // '2017-11-13 10:00:42';
	ip: string; // '117.136.86.38';
	likeCount: number; // 0;
	sessionId: string; // '2951869312404c36857c4655e394f15a';
	status: number; // 1;
}

export interface Project {
	id: number;
	accountId: number;
	name: string;
	title: string;
	content: string;
	createAt: string;
	clickCount: number;
	report: number;
	likeCount: number;
	favoriteCount: number;
}

export interface Share {
	id: number;
	accountId: number;
	projectId: number;
	title: string;
	content: string;
	createAt: string;
	clickCount: number;
	report: number;
	likeCount: number;
	favoriteCount: number;
}

export interface Feedback {
	id: number;
	accountId: number;
	projectId: number;
	title: string;
	content: string;
	createAt: string;
	clickCount: number;
	report: number;
	likeCount: number;
	favoriteCount: number;
}

export interface NewsFeed {
	id: number;
	accountId: number;
	accountNickName: string;
	accountAvatar: string;
	content: string;
	refType: 'project' | 'share' | 'feedback' | 'reply' | 'message';
	refId: number;
	messageCount?: number;
	refParentType?: 'project' | 'share' | 'feedback';
	refParentId?: number;
	refParentTitle?: string;
	refParentAccountId?: number;
	refParentAccountAvatar?: string;
	createAt: string;
	replies: {
		accountId: number;
		accountAvatar: string;
		content: string;
	}[];
}

export interface Remind {
	type: 'fans' | 'referMe' | 'message';
	text: string;
}

export class RemindList {
	@observable private list: Remind[] = [];
	@observable private removedRemindSet = new Map<number, boolean>();
	@observable private notifedRemindSet = new Map<number, boolean>();

	@computed
	get length(): number {
		return this.list.length - this.removedRemindSet.size;
	}

	@action
	push(remind: Remind) {
 
		let unremovedIndex = -1;
		for (let i = 0; i < this.list.length; i++) {
			if (!this.removedRemindSet.has(i) && this.list[i].type === remind.type) {
				unremovedIndex = i;
				break;
			}
		}
		if (unremovedIndex !== -1) {
			if (this.list[unremovedIndex].text === remind.text) {
			} else {
				this.splice(unremovedIndex);
				this.list.push(remind);
			}
		} else {
			this.list.push(remind);
		}
 
	}

	map<T>(f: (value: Remind, index: number) => T): T[] {
		const ret = [] as T[];
		let i = 0;
		for (let r of this.list) {
			if (!this.removedRemindSet.has(i)) {
				ret.push(f(r, i));
			}
			i++;
		}
		return ret;
	}

	mapWithoutNotifed<T>(f: (value: Remind, index: number) => T): T[] {
		const ret = [] as T[];
		let i = 0;
		for (let r of this.list) {
			if (!this.removedRemindSet.has(i) && !this.notifedRemindSet.has(i)) {
				ret.push(f(r, i));
			}
			i++;
		}
		return ret;
	}

	noti(i: number) {
		this.notifedRemindSet.set(i, true);
	}

	@action
	splice(start: number, deleteCount: number = 1) {
		for (let i = 0; i < deleteCount; i++) {
			this.removedRemindSet.set(i + start, true);
		}
	}

	findIndex(text: string): number {
		let i = 0;
		for (let r of this.list) {
			if (!this.removedRemindSet.has(i)) {
				if (r.text === text) {
					return i;
				}
			}
			i++;
		}
		return -1;
	}

	clear() {
		this.list.splice(0, this.list.length);
		this.removedRemindSet.clear();
		this.notifedRemindSet.clear();
	}
}

function toArray<T = any>(iter: IterableIterator<T>): T[] {
	const res = [];
	for (let t of iter) res.push(t);
	return res;
}

export class Ret {
	private proxy: Map<string, any> = new Map();

	private static STATE = 'state';
	private static STATE_OK = 'ok';
	private static STATE_FAIL = 'fail';

	set(key: string, value: any): Ret {
		this.proxy.set(key, value);
		return this;
	}

	get(key: string): any {
		return this.proxy.get(key);
	}

	remove(key: string): Ret {
		this.proxy.delete(key);
		return this;
	}

	setOk(): Ret {
		return this.set(Ret.STATE, Ret.STATE_OK);
	}

	setFail(): Ret {
		return this.set(Ret.STATE, Ret.STATE_FAIL);
	}

	get isOk(): boolean {
		return this.get(Ret.STATE) === Ret.STATE_OK;
	}

	get isFail(): boolean {
		return this.get(Ret.STATE) === Ret.STATE_FAIL;
	}

	static ok(): Ret {
		return new Ret().setOk();
	}

	static fail(): Ret {
		return new Ret().setFail();
	}

	static by(k: string, v: any): Ret {
		return new Ret().set(k, v);
	}
}
