import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  NgZone,
  OnDestroy,
  ViewChild
} from '@angular/core';
import { ProjectProxy } from './model/project-proxy';
import { Config, IdentifiedStaticSymbol, VisualizationConfig } from '../shared/data-format';
import { formatError } from './shared/utils';
import { Memento, StateManager } from './model/state-manager';
import { Theme } from '../shared/themes/color-map';
import { IPCBus } from './model/ipc-bus';
import { Message } from '../shared/ipc-constants';
import { fromEvent, Observable, Subscription } from 'rxjs';
import { debounceTime, filter, map, startWith, tap } from 'rxjs/operators';
import { Configuration } from './model/configuration';
import { ProjectLoadEvent } from './home';
import { BACKSPACE } from '@angular/cdk/keycodes';
import { QuickAccessComponent } from './components/quick-access';
import { KeyValue } from '@angular/common';

@Component({
  selector: 'ngrev-app',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AppComponent implements AfterViewInit, OnDestroy {
  projectSet = false;
  loading = false;
  queryList: KeyValue<string, IdentifiedStaticSymbol>[] = [];
  queryObject: string[] = ['value.name', 'value.filePath'];
  theme!: Theme;
  themes!: { [name: string]: Theme };
  showLibs = false;
  showModules = true;

  maxWidth$: Observable<number>;

  @ViewChild(QuickAccessComponent) quickAccess?: QuickAccessComponent;

  private _stopLoading = () => {
    this.loading = false;
    this._cd.markForCheck();
  };
  private _startLoading = () => {
    this.loading = true;
    this._cd.markForCheck();
  };

  private _keyDownSubscription: Subscription;

  constructor(
    public manager: StateManager,
    private _cd: ChangeDetectorRef,
    private _ngZone: NgZone,
    private _project: ProjectProxy,
    private _ipcBus: IPCBus,
    private _configuration: Configuration
  ) {
    this._configuration.getConfig().then((config: Config) => {
      this.themes = config.themes;
      this.theme = config.themes[config.theme];
      this.showLibs = config.showLibs;
      this.showModules = config.showModules;
      this._cd.markForCheck();
    });

    this.maxWidth$ = fromEvent(window, 'resize').pipe(
      debounceTime(100),
      map(() => window.innerWidth),
      startWith(window.innerWidth)
    );

    this._keyDownSubscription = fromEvent<KeyboardEvent>(document, 'keydown').pipe(
      filter((event: KeyboardEvent): boolean => !!(event.keyCode === BACKSPACE && this.quickAccess?.hidden)),
      tap({
        next: () => {
          this.prevState();
        }
      })
    ).subscribe();
  }

  ngAfterViewInit(): void {
    this._ipcBus.on(Message.ChangeTheme, (_: any, theme: string) => {
      this._ngZone.run(() => {
        this.theme = this.themes[theme];
        this._cd.markForCheck();
      });
    });
    this._ipcBus.on(Message.ToggleLibsMenuAction, () => {
      this._ngZone.run(() => {
        this.manager.toggleLibs().then(() => {
          this.manager.reloadAppState();
          this._cd.markForCheck();
        });
      });
    });
    this._ipcBus.on(Message.ToggleModulesMenuAction, () => {
      this._ngZone.run(() => {
        this.manager.toggleModules().then(() => {
          this.manager.reloadAppState();
          this._cd.markForCheck();
        });
      });
    });
  }

  ngOnDestroy(): void {
    this._keyDownSubscription.unsubscribe();
  }

  onProject({ tsconfig }: ProjectLoadEvent): void {
    this.projectSet = true;
    this._startLoading();
    this.manager
      .loadProject(tsconfig, this.showLibs, this.showModules)
      .then(() => this._project.getSymbols())
      .then((symbols: IdentifiedStaticSymbol[]): KeyValue<string, IdentifiedStaticSymbol>[] => {
        return this.queryList = symbols.map((symbol: IdentifiedStaticSymbol) => ({ key: symbol.name, value: symbol }));
      })
      .then(this._stopLoading)
      .catch((error: any) => {
        window.require('electron').remote.dialog.showErrorBox(
          'Error while parsing project',
          `Cannot parse your project. Make sure it's compatible with
the Angular's AoT compiler. Error during parsing:\n\n${formatError(error)}`
        );
        this._stopLoading();
      });
  }

  tryChangeState(id: string): void {
    this._ngZone.run(() => {
      this._startLoading();
      this.manager
        .tryChangeState(id)
        .then(() => {
          this._stopLoading();
        })
        .catch(() => {
          this._stopLoading();
        });
    });
  }

  selectSymbol(symbolPair: KeyValue<string, IdentifiedStaticSymbol>): void {
    if (symbolPair && symbolPair.value) {
      this.tryChangeState(symbolPair.value.id);
    }
  }

  restoreMemento(memento: Memento): void {
    this._ngZone.run(() => {
      this.manager
        .restoreMemento(memento)
        .then(this._stopLoading)
        .catch(this._stopLoading);
    });
  }

  get initialized(): VisualizationConfig<any> | null {
    return this.manager.getCurrentState(() => {
      this._cd.markForCheck();
    });
  }

  prevState(): void {
    const mementos = this.manager.getHistory();
    if (mementos.length > 1) {
      this.restoreMemento(mementos[mementos.length - 2]);
    }
  }
}
