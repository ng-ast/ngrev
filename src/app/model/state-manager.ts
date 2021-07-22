/* eslint-disable no-async-promise-executor */
import { IPCBus } from './ipc-bus';
import { Injectable } from '@angular/core';
import { VisualizationConfig } from '../../shared/data-format';
import { ProjectProxy } from './project-proxy';
import { StateProxy } from '../states/state-proxy';
import { Message } from '../../shared/ipc-constants';

export class Memento {
  constructor(public state: VisualizationConfig<any>, public dirty = false) {}
}

@Injectable({
  providedIn: 'root'
})
export class StateManager {
  private state?: StateProxy;
  private history: Memento[] = [];
  private transitionInProgress: string | null = null;
  private transitionResolveQueue: { resolve: (value?: unknown) => void; reject: (value?: unknown) => void }[] = [];

  constructor(private project: ProjectProxy, private bus: IPCBus) {}

  getHistory() {
    return this.history;
  }

  loadProject(tsconfig: string, showLibs: boolean, showModules: boolean) {
    return this.project
      .load(tsconfig, showLibs, showModules)
      .then(() => (this.state = new StateProxy()))
      .then((proxy: StateProxy) => proxy.getData())
      .then((data: VisualizationConfig<any>) => (this.history = [...this.history, new Memento(data)]));
  }

  toggleLibs() {
    return this.bus.send(Message.ToggleLibs);
  }

  toggleModules() {
    return this.bus.send(Message.ToggleModules);
  }

  tryChangeState(id: string) {
    if (this.transitionInProgress && this.transitionInProgress !== id) {
      return Promise.reject(new Error('Cannot change state while transition is pending.'));
    } else if (this.transitionInProgress === id) {
      return new Promise((resolve, reject) => this.transitionResolveQueue.push({ resolve, reject }));
    }
    if (!this.transitionInProgress) {
      this.transitionInProgress = id;
    }
    if (!this.state) {
      return Promise.reject(new Error('Project is not loaded yet.'));
    }
    return this.state!
      .directStateTransfer(id)
      .then(() => this.state!.getData())
      .then(data => {
        this.pushState(data);
        while (this.transitionResolveQueue.length) {
          const res = this.transitionResolveQueue.pop();
          if (res) {
            res.resolve(data);
          }
        }
        this.transitionInProgress = null;
        return data;
      })
      .catch(e => {
        while (this.transitionResolveQueue.length) {
          const res = this.transitionResolveQueue.pop();
          if (res) {
            res.reject(e);
          }
        }
        this.transitionInProgress = null;
        return Promise.reject(e);
      });
  }

  reloadAppState() {
    this.history[0].dirty = true;
  }

  getCurrentState(refreshOnReady?: () => void): VisualizationConfig<any> | null {
    const last = this.history[this.history.length - 1];
    if (last) {
      if (last.dirty) {
        last.dirty = false;
        this.state!.reload().then(state => {
          this.history.pop();
          this.history = [...this.history, new Memento(state)];
          refreshOnReady && refreshOnReady();
          return state;
        });
      }
      return last.state;
    } else {
      return null;
    }
  }

  getMetadata(nodeId: string) {
    return this.state!.getMetadata(nodeId);
  }

  async restoreMemento(memento: Memento) {
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    // eslint-disable-next-line no-async-promise-executor
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    return new Promise(async (resolve, reject) => {
      try {
        while (this.history.length) {
          const last = this.history[this.history.length - 1];
          if (last === memento) {
            break;
          } else {
            await this.popState();
          }
        }
        resolve(true);
      } catch (e) {
        reject(e);
      }
    });
  }

  private pushState(data: VisualizationConfig<any>) {
    this.history = [...this.history, new Memento(data)];
  }

  private popState() {
    return this.state!.prevState().then(() => {
      this.history.pop();
      this.history = [...this.history];
    });
  }
}
