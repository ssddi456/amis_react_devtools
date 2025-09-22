#!/bin/sh
set -e

# check if on master branch
current_branch=$(git symbolic-ref --short HEAD)
if [ "$current_branch" != "master" ]; then
  echo "Error: You must be on the master branch to run this script."
  exit 1
fi

# check if there are uncommitted changes
if [ -n "$(git status --porcelain)" ]; then
  echo "Error: You have uncommitted changes. Please commit or stash them before running this script."
  exit 1
fi

# check if build branch exists
if git show-ref --verify --quiet refs/heads/build; then
  git branch -D build
fi

git checkout -b build

npm install --workspaces

cd packages/demo-app

# start a sub process to build
npm run build

cd -
mkdir -p public
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
