import BigNumber from 'bignumber.js';

export interface SymbolMap<T> {
  [symbol: string]: T;
}

export type eNetwork = eEthereumNetwork;

export enum eEthereumNetwork {
  rinkeby = 'rinkeby',
  main = 'main',
  coverage = 'coverage',
  hardhat = 'hardhat',
}

export enum eContractid {
  MintableERC20 = 'MintableERC20',
  MintableERC721 = 'MintableERC721',
  CryptoPunksMarket = 'CryptoPunksMarket',
  BendCompetition = 'BendCompetition',
  WETHGateway = 'WETHGateway',
  Treasury = 'Treasury',
}

export type tEthereumAddress = string;
