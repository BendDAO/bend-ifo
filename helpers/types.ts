import BigNumber from 'bignumber.js';

export interface SymbolMap<T> {
  [symbol: string]: T;
}

export type eNetwork = eEthereumNetwork;

export enum eEthereumNetwork {
  coverage = 'coverage',
  hardhat = 'hardhat',
  localhost = 'localhost',
  rinkeby = 'rinkeby',
  main = 'main',
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
export interface iEthereumParamsPerNetwork<T> {
  [eEthereumNetwork.coverage]: T;
  [eEthereumNetwork.hardhat]: T;
  [eEthereumNetwork.localhost]: T;
  [eEthereumNetwork.rinkeby]: T;
  [eEthereumNetwork.main]: T;
  [network: string]: T;
}

export type iParamsPerNetwork<T> = iEthereumParamsPerNetwork<T>;
