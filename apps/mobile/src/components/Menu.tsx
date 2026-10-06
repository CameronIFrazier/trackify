// Top-bar navigation menu: a hamburger button that animates open horizontally
// into a row of icons (Home · Food Log · Account). Icons only; auto-collapses
// after a selection. Shared across web and native.
import { useRef, useState } from 'react';
import { View, TouchableOpacity, Animated, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export type MenuKey = 'home' | 'foodLog' | 'account';

type Item = {
  key: MenuKey;
  icon: keyof typeof Ionicons.glyphMap;       // shown when inactive
  activeIcon: keyof typeof Ionicons.glyphMap;  // shown for the current page
  label: string;                               // accessibility label
};

const ITEMS: Item[] = [
  { key: 'home', icon: 'home-outline', activeIcon: 'home', label: 'Home' },
  { key: 'foodLog', icon: 'calendar-outline', activeIcon: 'calendar', label: 'Food Log' },
  { key: 'account', icon: 'person-circle-outline', activeIcon: 'person-circle', label: 'Account' },
];

const ICON_BTN = 44;                                  // per-icon touch target
const EXPANDED_WIDTH = ITEMS.length * ICON_BTN + 8;   // full open width of the icon row

type Props = {
  active: MenuKey;                 // which page is current (its icon is highlighted)
  onSelect: (key: MenuKey) => void;
  accent?: string;                 // highlight color for the active icon
};

export default function Menu({ active, onSelect, accent = '#4338ca' }: Props) {
  const [open, setOpen] = useState(false);
  const anim = useRef(new Animated.Value(0)).current;

  const animateTo = (next: boolean) => {
    setOpen(next);
    Animated.timing(anim, {
      toValue: next ? 1 : 0,
      duration: 220,
      useNativeDriver: false, // animating width + opacity (layout props, not transforms)
    }).start();
  };

  const handleSelect = (key: MenuKey) => {
    onSelect(key);
    animateTo(false); // auto-collapse after navigating
  };

  return (
    <View style={styles.wrap}>
      {/* Icon row sits to the LEFT of the button and grows leftward, so it
          never runs off the right edge of the screen. */}
      <Animated.View
        style={[
          styles.iconRow,
          {
            width: anim.interpolate({ inputRange: [0, 1], outputRange: [0, EXPANDED_WIDTH] }),
            opacity: anim,
          },
        ]}
      >
        {ITEMS.map((item) => {
          const isActive = item.key === active;
          return (
            <TouchableOpacity
              key={item.key}
              style={styles.iconBtn}
              onPress={() => handleSelect(item.key)}
              accessibilityLabel={item.label}
              accessibilityRole="button"
            >
              <Ionicons
                name={isActive ? item.activeIcon : item.icon}
                size={24}
                color={isActive ? accent : '#666'}
              />
            </TouchableOpacity>
          );
        })}
      </Animated.View>

      <TouchableOpacity
        onPress={() => animateTo(!open)}
        style={styles.hamburger}
        accessibilityLabel={open ? 'Close menu' : 'Open menu'}
        accessibilityRole="button"
      >
        <Ionicons name={open ? 'close' : 'menu'} size={26} color="#333" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center' },
  iconRow: { flexDirection: 'row', alignItems: 'center', overflow: 'hidden', marginRight: 6 },
  iconBtn: { width: ICON_BTN, height: ICON_BTN, alignItems: 'center', justifyContent: 'center' },
  hamburger: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#ddd',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
