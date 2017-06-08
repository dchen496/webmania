#!/bin/bash
yarn
rm public/dist
ln -s ../dist public/dist
./node_modules/.bin/webpack --config webpack.config.js
