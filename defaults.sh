#!/bin/sh -x
defaults write com.microsoft.Excel OfficeWebAddinDeveloperExtras -bool true
defaults write com.microsoft.Excel CEFRuntimeLoggingFile -string $HOME/tmp/excel.log