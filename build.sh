#!/bin/sh
set -e

git checkout -b build

npm install --workspaces

cd packages/demo-app

# start a sub process to build
npm run build

cd -

cp -r packages/demo-app/dist/* ./public/

# 删除public 以外的文件
git ls-files | grep -v '^public/' | xargs git rm -rf

# 将public 下的文件移动到根目录
git mv public/* .

git rm -rf public

git add .

git commit -m 'build'

git push -f origin build:gh-pages

git checkout master

git branch -D build

npm install --workspaces
