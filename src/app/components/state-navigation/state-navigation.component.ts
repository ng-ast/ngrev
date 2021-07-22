import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { VisualizationConfig } from '../../../shared/data-format';
import { BoxTheme, DefaultColor, Theme } from '../../../shared/themes/color-map';
import { Memento } from '../../model/state-manager';
import { coerceNumberProperty } from '@angular/cdk/coercion';

const BoxWidth = 40;

const dummyConfig: VisualizationConfig<any> = {
  title: '...',
  graph: {
    nodes: [],
    edges: []
  }
};

const MetaMemento = new Memento(dummyConfig);

@Component({
  selector: 'ngrev-state-navigation',
  templateUrl: './state-navigation.component.html',
  styleUrls: ['./state-navigation.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class StateNavigationComponent {
  @Input() states: Memento[] = [];

  @Input()
  get maxWidth(): number { return this._maxWidth; }
  set maxWidth(value: number) {
    this._maxWidth = coerceNumberProperty(value);
  }
  private _maxWidth!: number;

  @Input() theme!: Theme;

  @Output() select: EventEmitter<Memento> = new EventEmitter<Memento>();

  visibleTooltip = -1;

  showTooltip(idx: number) {
    this.visibleTooltip = idx;
  }

  hideTooltip(idx: number) {
    this.visibleTooltip = -1;
  }

  changeState(state: Memento) {
    this.select.next(state);
  }

  isMetaState(state: Memento) {
    return state === MetaMemento;
  }

  getBackgroundColor(memento: Memento) {
    if (this.isMetaState(memento)) {
      return 'transparent';
    } else {
      const nodes = memento.state.graph.nodes;
      const first = nodes[0];
      if (first && first.type) {
        const config: BoxTheme = this.theme[(first.type.type as keyof Theme)] as BoxTheme;
        if (config) {
          return config.color.background;
        }
      }
      return DefaultColor.color.background;
    }
  }

  getRenderableItems() {
    const width = this.maxWidth;
    if (!width) {
      return [];
    } else {
      const maxBoxes = Math.floor(width / BoxWidth);
      if (maxBoxes === 0) {
        return [];
      }
      if (maxBoxes >= this.states.length) {
        return this.states;
      }
      const firstHalf = Math.floor(maxBoxes / 2);
      // -1 because of the meta box
      const secondHalf = maxBoxes - firstHalf - 1;
      return this.states
        .slice(0, firstHalf)
        .concat(MetaMemento)
        .concat(this.states.slice(this.states.length - secondHalf, this.states.length));
    }
  }
}
