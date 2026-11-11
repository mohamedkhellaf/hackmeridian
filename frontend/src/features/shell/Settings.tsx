import { useSettings } from '../../data'
import type { DensityChoice, PnlScheme, ThemeChoice } from '../../data'
import {
  DENSITY_CHOICES,
  IconButton,
  IconSettings,
  IconThemeDark,
  IconThemeLight,
  IconThemeSystem,
  Menu,
  MenuRadioGroup,
  MenuRadioItem,
  MenuSeparator,
  PNL_SCHEMES,
  Segmented,
  THEME_CHOICES,
} from '../../ui'
import { DENSITY_GROUP, DENSITY_LABEL, PNL_GROUP, PNL_LABEL, SETTINGS_TITLE, THEME_GROUP, THEME_LABEL } from './copy'
import { GuideMenuGroup } from './GuideEntry'
import styles from './Settings.module.css'

const THEME_ICON: Record<ThemeChoice, typeof IconThemeSystem> = { system: IconThemeSystem, light: IconThemeLight, dark: IconThemeDark }

/**
 * The settings menu of the top bar: theme, table density, and the colours of gains and losses. Each choice
 * applies at once and is remembered in this browser (the data layer stores it); the menu stays open so a
 * choice can be compared with the next.
 */
export function SettingsMenu() {
  const { theme, density, pnl, set } = useSettings()
  return (
    <Menu size="tall" trigger={<IconButton label={SETTINGS_TITLE} icon={<IconSettings />} />}>
      <MenuRadioGroup<ThemeChoice> label={THEME_GROUP} value={theme} onValueChange={(next) => set({ theme: next })}>
        {THEME_CHOICES.map((choice) => {
          const Icon = THEME_ICON[choice]
          return (
            <MenuRadioItem key={choice} value={choice} icon={<Icon />}>
              {THEME_LABEL[choice]}
            </MenuRadioItem>
          )
        })}
      </MenuRadioGroup>
      <MenuSeparator />
      <MenuRadioGroup<DensityChoice> label={DENSITY_GROUP} value={density} onValueChange={(next) => set({ density: next })}>
        {DENSITY_CHOICES.map((choice) => (
          <MenuRadioItem key={choice} value={choice}>
            {DENSITY_LABEL[choice]}
          </MenuRadioItem>
        ))}
      </MenuRadioGroup>
      <MenuSeparator />
      <MenuRadioGroup<PnlScheme> label={PNL_GROUP} value={pnl} onValueChange={(next) => set({ pnl: next })}>
        {PNL_SCHEMES.map((choice) => (
          <MenuRadioItem key={choice} value={choice}>
            {PNL_LABEL[choice]}
          </MenuRadioItem>
        ))}
      </MenuRadioGroup>
      <GuideMenuGroup />
    </Menu>
  )
}

/**
 * The same three settings as plain controls, for the More sheet on phones, where a menu inside a sheet would
 * be a second layer. Each is a radio group with one tab stop.
 */
export function SettingsControls() {
  const { theme, density, pnl, set } = useSettings()
  return (
    <div className={styles.controls}>
      <Segmented<ThemeChoice>
        label={THEME_GROUP}
        showLabel
        fullWidth
        value={theme}
        onValueChange={(next) => set({ theme: next })}
        options={THEME_CHOICES.map((choice) => ({ value: choice, label: THEME_LABEL[choice] }))}
      />
      <Segmented<DensityChoice>
        label={DENSITY_GROUP}
        showLabel
        fullWidth
        value={density}
        onValueChange={(next) => set({ density: next })}
        options={DENSITY_CHOICES.map((choice) => ({ value: choice, label: DENSITY_LABEL[choice] }))}
      />
      <Segmented<PnlScheme>
        label={PNL_GROUP}
        showLabel
        fullWidth
        value={pnl}
        onValueChange={(next) => set({ pnl: next })}
        options={PNL_SCHEMES.map((choice) => ({ value: choice, label: PNL_LABEL[choice] }))}
      />
    </div>
  )
}
