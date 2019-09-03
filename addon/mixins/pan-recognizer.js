import Mixin from '@ember/object/mixin';
import { get, set } from '@ember/object';
import { inject as service } from '@ember/service';

import RunOnRafMixin from 'ember-mobile-core/mixins/run-on-raf';
import parseTouchData, {
  parseInitialTouchData,
  isHorizontal,
  isVertical
} from 'ember-mobile-core/utils/parse-touch-data';

export default Mixin.create(RunOnRafMixin, {
  panManager: service(),

  // public
  threshold: 10,
  axis: 'horizontal',
  useCapture: false,
  preventScroll: true,
  panArea: null,

  // private
  currentTouches: null,

  init(){
    this._super(...arguments);

    set(this, 'currentTouches', new Map());
  },

  // hooks
  didPanStart(){},
  didPan(){},
  didPanEnd(){},

  //public functions
  lockPan(){
    get(this, 'panManager').lock(get(this, 'elementId'));
  },
  unlockPan(){
    get(this, 'panManager').unlock(get(this, 'elementId'));
  },

  didInsertElement(){
    this._super(...arguments);

    // if an axis is set, limit scroll to a single axis
    const axis = get(this, 'axis');

    if(axis === 'horizontal'){
      this.element.style.touchAction = 'pan-y';
    } else if(axis === 'vertical') {
      this.element.style.touchAction = 'pan-x';
    }

    const options = {
      capture: get(this, 'useCapture'),
      passive: true
    };

    this.element.addEventListener('touchstart', get(this, 'didTouchStart').bind(this), options);
    this.element.addEventListener('touchmove', get(this, 'didTouchMove').bind(this), options);
    this.element.addEventListener('touchend', get(this, 'didTouchEnd').bind(this), options);
    this.element.addEventListener('touchcancel', get(this, 'didTouchEnd').bind(this), options);
  },

  willDestroyElement(){
    this._super(...arguments);

    const options = {
      capture: get(this, 'useCapture'),
      passive: true
    };
    this.element.removeEventListener('touchstart', get(this, 'didTouchStart').bind(this), options);
    this.element.removeEventListener('touchmove', get(this, 'didTouchMove').bind(this), options);
    this.element.removeEventListener('touchend', get(this, 'didTouchEnd').bind(this), options);
    this.element.removeEventListener('touchcancel', get(this, 'didTouchEnd').bind(this), options);
  },

  // events
  didTouchStart(e){
    const currentTouches = get(this, 'currentTouches');

    for(const touch of e.changedTouches){
      const touchData = parseInitialTouchData(touch, e);

      currentTouches.set(touch.identifier, touchData);
    }
  },
  didTouchMove(e){
    const currentTouches = get(this, 'currentTouches');

    for(const touch of e.changedTouches){
      const previousTouchData = currentTouches.get(touch.identifier);
      const touchData = parseTouchData(previousTouchData, touch, e);

      if(touchData.panStarted){
        // prevent scroll if a pan is still busy
        if(get(this, 'preventScroll')){
          e.preventDefault();
        }

        // fire didPan hook only if there is a lock on the current element or there is no lock
        if(get(this, 'panManager.panLocked') === get(this, 'elementId') || !get(this, 'panManager.panLocked')){
          this.runOnRaf(() => this.didPan(touchData.data));
        }
      } else if(!get(this, 'panManager.panLocked')){
        const axis = get(this, 'axis');

        // only pan when pan wasn't denied and the threshold for the given axis is achieved
        if(
          !touchData.panDenied
          && (
               (axis === 'horizontal' && Math.abs(touchData.data.current.distanceX) > get(this, 'threshold'))
            || (axis === 'vertical' && Math.abs(touchData.data.current.distanceY) > get(this, 'threshold'))
          )
        ){
          // test if axis matches with data else deny the pan
          if(  (axis === 'horizontal' && isHorizontal(touchData))
            || (axis === 'vertical' && isVertical(touchData))
          ){
            // prevent scroll if a pan is detected
            if(get(this, 'preventScroll')){
              e.preventDefault();
            }

            touchData.panStarted = true;

            // trigger panStart hook
            this.didPanStart(touchData.data);
          } else {
            touchData.panDenied = true;
          }
        }
      }

      currentTouches.set(touch.identifier, touchData);
    }
  },
  didTouchEnd(e){
    const currentTouches = get(this, 'currentTouches');

    for(const touch of e.changedTouches){
      const previousTouchData = currentTouches.get(touch.identifier);
      const touchData = parseTouchData(previousTouchData, touch, e);

      if(touchData.panStarted && (get(this, 'panManager.panLocked') === get(this, 'elementId') || !get(this, 'panManager.panLocked'))){
        this.didPanEnd(touchData.data);
      }

      currentTouches.delete(touch.identifier);
    }

    this.unlockPan();
  }
});
